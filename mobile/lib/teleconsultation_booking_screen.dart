import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'teleconsultation_room_screen.dart';

class TeleconsultationBookingScreen extends StatefulWidget {
  const TeleconsultationBookingScreen({
    super.key,
    required this.doctor,
    required this.residentId,
    required this.residentName,
  });

  final Map<String, dynamic> doctor;
  final String residentId;
  final String residentName;

  @override
  State<TeleconsultationBookingScreen> createState() =>
      _TeleconsultationBookingScreenState();
}

class _TeleconsultationBookingScreenState
    extends State<TeleconsultationBookingScreen> {
  static const List<String> _availableSlots = [
    '09:00-09:30',
    '09:30-10:00',
    '10:00-10:30',
    '10:30-11:00',
    '14:00-14:30',
    '14:30-15:00',
    '15:00-15:30',
    '15:30-16:00',
  ];

  final TextEditingController _dateController = TextEditingController();
  List<Map<String, dynamic>> _myAppointments = [];
  DateTime? _selectedDate;
  String? _selectedSlot;
  bool _isLoading = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadAppointments();
  }

  @override
  void dispose() {
    _dateController.dispose();
    super.dispose();
  }

  Future<void> _loadAppointments() async {
    setState(() => _isLoading = true);
    try {
      final response = await http.get(
        ApiConfig.uri(
          '/teleconsultation/appointments/resident/${widget.residentId}',
        ),
      );
      if (!mounted) return;
      if (response.statusCode == 200) {
        final list = jsonDecode(response.body) as List<dynamic>;
        setState(() {
          _myAppointments = list
              .map((e) => Map<String, dynamic>.from(e as Map))
              .where(
                (a) =>
                    a['doctorId']?.toString() ==
                    widget.doctor['id']?.toString(),
              )
              .toList();
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 1),
    );
    if (picked == null) return;
    setState(() {
      _selectedDate = picked;
      _dateController.text = _formatDate(picked);
    });
  }

  String _formatDate(DateTime d) {
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<void> _bookAppointment() async {
    if (_selectedDate == null || _selectedSlot == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a date and time slot.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final response = await http.post(
        ApiConfig.uri('/teleconsultation/appointments'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'residentId': widget.residentId,
          'doctorId': widget.doctor['id']?.toString(),
          'date': _dateController.text.trim(),
          'timeSlot': _selectedSlot,
        }),
      );

      if (!mounted) return;

      if (response.statusCode == 201 || response.statusCode == 200) {
        final appointment =
            jsonDecode(response.body) as Map<String, dynamic>;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Appointment booked successfully!')),
        );
        await _loadAppointments();
        if (!mounted) return;
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => TeleconsultationRoomScreen(
              appointment: appointment,
              residentId: widget.residentId,
              residentName: widget.residentName,
            ),
          ),
        );
      } else {
        final body = response.body.isNotEmpty
            ? jsonDecode(response.body) as Map<String, dynamic>?
            : null;
        final msg = body?['message']?.toString() ?? 'Failed to book appointment.';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed':
        return Colors.green;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Scheduled';
    }
  }

  @override
  Widget build(BuildContext context) {
    final doctorName = widget.doctor['name']?.toString() ?? 'Doctor';
    final specialty = widget.doctor['specialty']?.toString() ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text('Book with $doctorName'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAppointments,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doctorName,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          if (specialty.isNotEmpty)
                            Text(
                              specialty,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                          const Divider(height: 24),
                          Text(
                            'Schedule Teleconsultation',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _dateController,
                            readOnly: true,
                            onTap: _pickDate,
                            decoration: const InputDecoration(
                              labelText: 'Appointment Date',
                              suffixIcon: Icon(Icons.calendar_today_outlined),
                            ),
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            value: _selectedSlot,
                            decoration: const InputDecoration(
                              labelText: 'Time Slot',
                            ),
                            items: _availableSlots
                                .map(
                                  (slot) => DropdownMenuItem(
                                    value: slot,
                                    child: Text(slot),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                setState(() => _selectedSlot = value),
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            icon: const Icon(Icons.video_call_outlined),
                            label: Text(
                              _isSubmitting
                                  ? 'Booking...'
                                  : 'Confirm & Join Room',
                            ),
                            onPressed: _isSubmitting ? null : _bookAppointment,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_myAppointments.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text(
                      'My Appointments with $doctorName',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 12),
                    ..._myAppointments.map((appt) {
                      final status =
                          appt['status']?.toString() ?? 'scheduled';
                      final color = _statusColor(status);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          child: ListTile(
                            title: Text(
                              '${appt['date']} • ${appt['timeSlot']}',
                            ),
                            subtitle: Text(doctorName),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                _statusLabel(status),
                                style: TextStyle(
                                  color: color,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            onTap: status == 'scheduled'
                                ? () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            TeleconsultationRoomScreen(
                                          appointment: appt,
                                          residentId: widget.residentId,
                                          residentName: widget.residentName,
                                        ),
                                      ),
                                    );
                                  }
                                : null,
                          ),
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }
}
