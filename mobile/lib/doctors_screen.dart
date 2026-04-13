import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'teleconsultation_booking_screen.dart';

class DoctorsScreen extends StatefulWidget {
  const DoctorsScreen({super.key, required this.residentId, this.residentName});

  final String? residentId;
  final String? residentName;

  @override
  State<DoctorsScreen> createState() => _DoctorsScreenState();
}

class _DoctorsScreenState extends State<DoctorsScreen> {
  List<Map<String, dynamic>> _doctors = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDoctors();
  }

  Future<void> _loadDoctors() async {
    setState(() => _isLoading = true);
    try {
      final response = await http.get(ApiConfig.uri('/teleconsultation/doctors'));
      if (!mounted) return;
      if (response.statusCode == 200) {
        final list = jsonDecode(response.body) as List<dynamic>;
        setState(() {
          _doctors = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        });
      } else {
        _showError('Failed to load doctors.');
      }
    } catch (_) {
      if (mounted) _showError('Failed to load doctors.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Doctors')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadDoctors,
              child: _doctors.isEmpty
                  ? const Center(child: Text('No doctors available.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _doctors.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final doctor = _doctors[index];
                        final name = doctor['name']?.toString() ?? '';
                        final specialty = doctor['specialty']?.toString() ?? '';
                        final bio = doctor['bio']?.toString() ?? '';
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 28,
                                      backgroundColor:
                                          Theme.of(context).colorScheme.primaryContainer,
                                      child: Text(
                                        name.isNotEmpty ? name[0] : '?',
                                        style: TextStyle(
                                          fontSize: 22,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onPrimaryContainer,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            name,
                                            style: Theme.of(context).textTheme.titleMedium,
                                          ),
                                          Text(
                                            specialty,
                                            style: TextStyle(
                                              color: Theme.of(context).colorScheme.primary,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                if (bio.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Text(bio, style: Theme.of(context).textTheme.bodySmall),
                                ],
                                const SizedBox(height: 14),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    FilledButton.icon(
                                      icon: const Icon(Icons.video_call_outlined),
                                      label: const Text('Book Teleconsultation'),
                                      onPressed: widget.residentId == null
                                          ? null
                                          : () {
                                              Navigator.of(context).push(
                                                MaterialPageRoute(
                                                  builder: (_) =>
                                                      TeleconsultationBookingScreen(
                                                    doctor: doctor,
                                                    residentId: widget.residentId!,
                                                    residentName:
                                                        widget.residentName ?? 'Resident',
                                                  ),
                                                ),
                                              );
                                            },
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
