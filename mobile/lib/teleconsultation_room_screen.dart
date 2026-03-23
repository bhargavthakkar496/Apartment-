import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:url_launcher/url_launcher.dart';

import 'api_config.dart';

class TeleconsultationRoomScreen extends StatefulWidget {
  const TeleconsultationRoomScreen({
    super.key,
    required this.appointment,
    required this.residentId,
    required this.residentName,
  });

  final Map<String, dynamic> appointment;
  final String residentId;
  final String residentName;

  @override
  State<TeleconsultationRoomScreen> createState() =>
      _TeleconsultationRoomScreenState();
}

class _TeleconsultationRoomScreenState
    extends State<TeleconsultationRoomScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<Map<String, dynamic>> _messages = [];

  io.Socket? _socket;
  bool _isConnected = false;
  bool _isLoadingHistory = true;
  bool _isSending = false;

  String get _appointmentId => widget.appointment['id']?.toString() ?? '';
  String get _doctorName =>
      (widget.appointment['doctor'] as Map<String, dynamic>?)?['name']
          ?.toString() ??
      widget.appointment['doctorName']?.toString() ??
      'Doctor';

  @override
  void initState() {
    super.initState();
    _loadChatHistory();
    _connectSocket();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _socket?.emit('leaveRoom', {
      'appointmentId': _appointmentId,
      'participantName': widget.residentName,
    });
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }

  Future<void> _loadChatHistory() async {
    try {
      final response = await http.get(
        ApiConfig.uri(
          '/teleconsultation/appointments/$_appointmentId/messages',
        ),
      );
      if (!mounted) return;
      if (response.statusCode == 200) {
        final list = jsonDecode(response.body) as List<dynamic>;
        setState(() {
          _messages.clear();
          _messages.addAll(
            list.map((e) => Map<String, dynamic>.from(e as Map)),
          );
        });
        _scrollToBottom();
      }
    } finally {
      if (mounted) setState(() => _isLoadingHistory = false);
    }
  }

  void _connectSocket() {
    final wsUrl = _buildWsUrl();
    _socket = io.io(
      wsUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath('/socket.io')
          .enableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      if (!mounted) return;
      setState(() => _isConnected = true);
      _socket!.emit('joinRoom', {
        'appointmentId': _appointmentId,
        'participantName': widget.residentName,
      });
    });

    _socket!.onDisconnect((_) {
      if (!mounted) return;
      setState(() => _isConnected = false);
    });

    _socket!.on('newMessage', (data) {
      if (!mounted) return;
      final msg = Map<String, dynamic>.from(data as Map);
      final alreadyExists =
          _messages.any((m) => m['id']?.toString() == msg['id']?.toString());
      if (!alreadyExists) {
        setState(() => _messages.add(msg));
        _scrollToBottom();
      }
    });

    _socket!.on('participantJoined', (data) {
      if (!mounted) return;
      final name =
          (data as Map<String, dynamic>)['participantName']?.toString() ??
              'Someone';
      _addSystemMessage('$name joined the consultation room.');
    });

    _socket!.on('participantLeft', (data) {
      if (!mounted) return;
      final name =
          (data as Map<String, dynamic>)['participantName']?.toString() ??
              'Someone';
      _addSystemMessage('$name left the consultation room.');
    });

    _socket!.on('callStarted', (data) {
      if (!mounted) return;
      final meetingUrl =
          (data as Map<String, dynamic>)['meetingUrl']?.toString() ?? '';
      final startedBy = data['startedBy']?.toString() ?? 'Someone';
      _addSystemMessage('$startedBy started a video call.');
      if (meetingUrl.isNotEmpty) {
        _showJoinCallDialog(meetingUrl);
      }
    });

    _socket!.on('callEnded', (data) {
      if (!mounted) return;
      final endedBy =
          (data as Map<String, dynamic>)['endedBy']?.toString() ?? 'Someone';
      _addSystemMessage('$endedBy ended the video call.');
    });

    _socket!.connect();
  }

  String _buildWsUrl() {
    final base = ApiConfig.baseUrl;
    final uri = Uri.tryParse(base);
    if (uri == null) return base;
    final wsScheme = uri.scheme == 'https' ? 'wss' : 'ws';
    return uri.replace(scheme: wsScheme).toString();
  }

  void _addSystemMessage(String text) {
    setState(() {
      _messages.add({
        'id': 'sys-${DateTime.now().millisecondsSinceEpoch}',
        'isSystem': true,
        'message': text,
        'sentAt': DateTime.now().toIso8601String(),
      });
    });
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || !_isConnected) return;

    setState(() => _isSending = true);
    _messageController.clear();

    try {
      _socket!.emit('sendMessage', {
        'appointmentId': _appointmentId,
        'senderId': widget.residentId,
        'senderName': widget.residentName,
        'message': text,
      });
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _startVideoCall() async {
    if (!_isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Not connected to the consultation room.')),
      );
      return;
    }
    _socket!.emit('startCall', {
      'appointmentId': _appointmentId,
      'participantName': widget.residentName,
    });
    final meetingUrl = 'https://meet.jit.si/ApartmentConsult-$_appointmentId';
    await _launchMeetingUrl(meetingUrl);
  }

  Future<void> _launchMeetingUrl(String meetingUrl) async {
    final uri = Uri.parse(meetingUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open: $meetingUrl')),
      );
    }
  }

  void _showJoinCallDialog(String meetingUrl) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Video Call Started'),
        content: const Text(
          'A video call has been started. Would you like to join?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Later'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _launchMeetingUrl(meetingUrl);
            },
            child: const Text('Join Now'),
          ),
        ],
      ),
    );
  }

  String _formatTime(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final apptDate = widget.appointment['date']?.toString() ?? '';
    final apptSlot = widget.appointment['timeSlot']?.toString() ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_doctorName),
            Text(
              '$apptDate • $apptSlot',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.white70),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Tooltip(
              message: _isConnected ? 'Connected' : 'Disconnected',
              child: Icon(
                Icons.circle,
                size: 12,
                color: _isConnected ? Colors.greenAccent : Colors.redAccent,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.video_call_outlined),
            tooltip: 'Start Video Call',
            onPressed: _startVideoCall,
          ),
        ],
      ),
      body: Column(
        children: [
          if (!_isConnected)
            Container(
              width: double.infinity,
              color: Colors.orange.shade100,
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
              child: const Text(
                'Connecting to consultation room…',
                style: TextStyle(color: Colors.orange, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ),
          Expanded(
            child: _isLoadingHistory
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.chat_bubble_outline,
                              size: 48,
                              color: Colors.grey,
                            ),
                            const SizedBox(height: 12),
                            const Text('No messages yet.'),
                            const SizedBox(height: 8),
                            Text(
                              'Start the conversation with $_doctorName',
                              style: const TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final msg = _messages[index];
                          if (msg['isSystem'] == true) {
                            return _SystemMessageBubble(
                              text: msg['message']?.toString() ?? '',
                            );
                          }
                          final isMe =
                              msg['senderId']?.toString() == widget.residentId;
                          return _ChatMessageBubble(
                            message: msg['message']?.toString() ?? '',
                            senderName: msg['senderName']?.toString() ?? '',
                            time: _formatTime(msg['sentAt']?.toString()),
                            isMe: isMe,
                          );
                        },
                      ),
          ),
          Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 8,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: 'Type a message…',
                        filled: true,
                        fillColor: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    icon: _isSending
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded),
                    onPressed: _isSending || !_isConnected ? null : _sendMessage,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatMessageBubble extends StatelessWidget {
  const _ChatMessageBubble({
    required this.message,
    required this.senderName,
    required this.time,
    required this.isMe,
  });

  final String message;
  final String senderName;
  final String time;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        decoration: BoxDecoration(
          color: isMe
              ? colorScheme.primaryContainer
              : colorScheme.secondaryContainer,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMe ? 16 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 16),
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isMe)
              Text(
                senderName,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.primary,
                ),
              ),
            Text(message),
            const SizedBox(height: 4),
            Text(
              time,
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}

class _SystemMessageBubble extends StatelessWidget {
  const _SystemMessageBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.grey.withOpacity(0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          text,
          style: const TextStyle(fontSize: 12, color: Colors.grey),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
