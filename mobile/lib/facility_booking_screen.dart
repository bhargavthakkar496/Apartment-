import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'api_config.dart';

class FacilityBookingScreen extends StatefulWidget {
  const FacilityBookingScreen({super.key});

  @override
  State<FacilityBookingScreen> createState() => _FacilityBookingScreenState();
}

class _FacilityBookingScreenState extends State<FacilityBookingScreen> {
  final TextEditingController _facilityController = TextEditingController();
  final TextEditingController _dateController = TextEditingController();

  Future<void> _bookFacility() async {
    final response = await http.post(
      ApiConfig.uri('/facilities/book'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'facility': _facilityController.text,
        'date': _dateController.text,
      }),
    );

    if (response.statusCode == 200) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Facility booked successfully!')),
      );
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to book facility.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Facility Booking')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _facilityController,
              decoration: const InputDecoration(labelText: 'Facility Name'),
            ),
            TextField(
              controller: _dateController,
              decoration: const InputDecoration(labelText: 'Date (YYYY-MM-DD)'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _bookFacility,
              child: const Text('Book Facility'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _facilityController.dispose();
    _dateController.dispose();
    super.dispose();
  }
}
