import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TeleconsultationService } from './teleconsultation.service';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
  namespace: '/teleconsultation',
})
export class TeleconsultationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private teleconsultationService: TeleconsultationService) {}

  handleConnection(client: Socket) {
    console.log(`Teleconsultation client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Teleconsultation client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { appointmentId: string; participantName: string },
  ) {
    const room = `appointment:${data.appointmentId}`;
    client.join(room);
    client.to(room).emit('participantJoined', {
      participantName: data.participantName,
    });
    return { event: 'joinedRoom', room };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { appointmentId: string; participantName: string },
  ) {
    const room = `appointment:${data.appointmentId}`;
    client.leave(room);
    client.to(room).emit('participantLeft', {
      participantName: data.participantName,
    });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      appointmentId: string;
      senderId: string;
      senderName: string;
      message: string;
    },
  ) {
    const saved = await this.teleconsultationService.saveMessage(
      data.appointmentId,
      data.senderId,
      data.senderName,
      data.message,
    );

    const room = `appointment:${data.appointmentId}`;
    this.server.to(room).emit('newMessage', {
      id: saved.id,
      appointmentId: saved.appointmentId,
      senderId: saved.senderId,
      senderName: saved.senderName,
      message: saved.message,
      sentAt: saved.sentAt,
    });

    return saved;
  }

  @SubscribeMessage('startCall')
  handleStartCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { appointmentId: string; participantName: string },
  ) {
    const meetingUrl = `https://meet.jit.si/ApartmentConsult-${data.appointmentId}`;
    const room = `appointment:${data.appointmentId}`;
    this.server.to(room).emit('callStarted', {
      meetingUrl,
      startedBy: data.participantName,
    });
    return { meetingUrl };
  }

  @SubscribeMessage('endCall')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { appointmentId: string; participantName: string },
  ) {
    const room = `appointment:${data.appointmentId}`;
    this.server.to(room).emit('callEnded', {
      endedBy: data.participantName,
    });
  }
}
