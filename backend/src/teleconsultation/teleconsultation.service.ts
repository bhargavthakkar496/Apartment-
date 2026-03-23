import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type DefaultDoctor = {
  name: string;
  specialty: string;
  bio: string;
};

@Injectable()
export class TeleconsultationService {
  private static readonly defaultDoctors: DefaultDoctor[] = [
    {
      name: 'Dr. Ananya Sharma',
      specialty: 'General Physician',
      bio: 'MBBS, MD – 12 years of experience in general medicine and preventive healthcare.',
    },
    {
      name: 'Dr. Rajesh Mehta',
      specialty: 'Cardiologist',
      bio: 'DM Cardiology – Specialist in heart disease management and cardiac rehabilitation.',
    },
    {
      name: 'Dr. Priya Nair',
      specialty: 'Dermatologist',
      bio: 'MD Dermatology – Expert in skin, hair, and nail disorders.',
    },
    {
      name: 'Dr. Vikram Singh',
      specialty: 'Orthopedic Surgeon',
      bio: 'MS Orthopedics – 15 years of experience in bone and joint care.',
    },
    {
      name: 'Dr. Sunita Rao',
      specialty: 'Pediatrician',
      bio: 'MD Pediatrics – Dedicated to child health from newborn to adolescent.',
    },
  ];

  private defaultDoctorsInitialized = false;
  private defaultDoctorsInitPromise: Promise<void> | null = null;

  constructor(private prisma: PrismaService) {}

  async getDoctors() {
    await this.ensureDefaultDoctors();
    return this.prisma.doctor.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getDoctorById(doctorId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId.trim() },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found.');
    }
    return doctor;
  }

  async bookAppointment(
    residentId: string,
    doctorId: string,
    date: string,
    timeSlot: string,
  ) {
    const normalizedResidentId = residentId.trim();
    const normalizedDoctorId = doctorId.trim();
    const normalizedDate = this.normalizeDate(date);
    const normalizedSlot = timeSlot.trim();

    if (!normalizedSlot) {
      throw new BadRequestException('timeSlot is required.');
    }

    const resident = await this.prisma.resident.findUnique({
      where: { id: normalizedResidentId },
    });
    if (!resident || !resident.isActive) {
      throw new BadRequestException('Only active residents can book appointments.');
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: normalizedDoctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found.');
    }

    const conflict = await this.prisma.teleconsultationAppointment.findFirst({
      where: {
        doctorId: normalizedDoctorId,
        date: normalizedDate,
        timeSlot: normalizedSlot,
        status: { not: 'cancelled' },
      },
    });
    if (conflict) {
      throw new BadRequestException(
        'This time slot is already booked for the selected doctor and date.',
      );
    }

    const duplicate = await this.prisma.teleconsultationAppointment.findFirst({
      where: {
        residentId: normalizedResidentId,
        doctorId: normalizedDoctorId,
        date: normalizedDate,
        timeSlot: normalizedSlot,
        status: { not: 'cancelled' },
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        'You already have a booking for this doctor and time slot.',
      );
    }

    return this.prisma.teleconsultationAppointment.create({
      data: {
        residentId: normalizedResidentId,
        doctorId: normalizedDoctorId,
        date: normalizedDate,
        timeSlot: normalizedSlot,
        status: 'scheduled',
      },
      include: { doctor: true },
    });
  }

  async getResidentAppointments(residentId: string) {
    const normalizedResidentId = residentId.trim();
    if (!normalizedResidentId) {
      throw new BadRequestException('residentId is required.');
    }
    return this.prisma.teleconsultationAppointment.findMany({
      where: { residentId: normalizedResidentId },
      include: { doctor: true },
      orderBy: [{ date: 'desc' }],
    });
  }

  async getAppointmentDetails(appointmentId: string) {
    const appointment = await this.prisma.teleconsultationAppointment.findUnique({
      where: { id: appointmentId.trim() },
      include: {
        doctor: true,
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }
    return appointment;
  }

  async getAppointmentMessages(appointmentId: string) {
    return this.prisma.teleconsultationMessage.findMany({
      where: { appointmentId: appointmentId.trim() },
      orderBy: { sentAt: 'asc' },
    });
  }

  async saveMessage(
    appointmentId: string,
    senderId: string,
    senderName: string,
    message: string,
  ) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      throw new BadRequestException('message cannot be empty.');
    }
    return this.prisma.teleconsultationMessage.create({
      data: {
        appointmentId: appointmentId.trim(),
        senderId: senderId.trim(),
        senderName: senderName.trim(),
        message: normalizedMessage,
      },
    });
  }

  async cancelAppointment(appointmentId: string, residentId: string) {
    const appointment = await this.prisma.teleconsultationAppointment.findUnique({
      where: { id: appointmentId.trim() },
    });
    if (!appointment || appointment.residentId !== residentId.trim()) {
      throw new NotFoundException('Appointment not found.');
    }
    if (appointment.status === 'cancelled') {
      throw new BadRequestException('Appointment is already cancelled.');
    }
    return this.prisma.teleconsultationAppointment.update({
      where: { id: appointment.id },
      data: { status: 'cancelled' },
    });
  }

  private normalizeDate(value: string) {
    const normalized = value?.trim() ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format.');
    }
    return normalized;
  }

  private async ensureDefaultDoctors() {
    if (this.defaultDoctorsInitialized) return;
    if (this.defaultDoctorsInitPromise) {
      return this.defaultDoctorsInitPromise;
    }
    this.defaultDoctorsInitPromise = Promise.all(
      TeleconsultationService.defaultDoctors.map((doc) =>
        this.prisma.doctor.upsert({
          where: { name: doc.name },
          update: { specialty: doc.specialty, bio: doc.bio },
          create: doc,
        }),
      ),
    ).then(() => {
      this.defaultDoctorsInitialized = true;
      this.defaultDoctorsInitPromise = null;
    });
    return this.defaultDoctorsInitPromise;
  }
}
