import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

class FacilityBookingScreen extends StatefulWidget {
  const FacilityBookingScreen({
    super.key,
    required this.residentId,
  });

  final String? residentId;

  @override
  State<FacilityBookingScreen> createState() => _FacilityBookingScreenState();
}

class _FacilityBookingScreenState extends State<FacilityBookingScreen> {
  final TextEditingController _dateController = TextEditingController();
  List<Map<String, dynamic>> _facilities = [];
  List<dynamic> _myRequests = [];
  List<String> _gymTimeSlots = [];
  String? _selectedFacilityId;
  String? _selectedTimeSlot;
  DateTime? _selectedDate;
  String? _availabilityHint;
  int? _remainingCapacity;
  bool _isAvailabilityFull = false;
  bool _hasPendingConflict = false;
  bool _isLoading = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _dateController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty) {
      setState(() {
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final facilitiesResponse = await http.get(ApiConfig.uri('/facility/available'));
    final requestsResponse = await http.get(
      ApiConfig.uri('/facility/resident/$residentId/bookings'),
    );

    if (!mounted) return;

    if (facilitiesResponse.statusCode == 200 && requestsResponse.statusCode == 200) {
      final facilitiesBody = jsonDecode(facilitiesResponse.body) as Map<String, dynamic>;
      final facilities = (facilitiesBody['items'] as List<dynamic>? ?? <dynamic>[])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      setState(() {
        _facilities = facilities;
        _gymTimeSlots = (facilitiesBody['gymTimeSlots'] as List<dynamic>? ?? <dynamic>[])
            .map((item) => item.toString())
            .toList();
        _selectedFacilityId =
            facilities.isNotEmpty ? facilities.first['id']?.toString() : null;
        _selectedTimeSlot = null;
        if (_selectedDate != null) {
          _dateController.text = _formatDateForApi(_selectedDate!);
        }
        _myRequests = jsonDecode(requestsResponse.body) as List<dynamic>;
        _isLoading = false;
      });
      await _refreshAvailabilityHint();
      return;
    }

    setState(() {
      _isLoading = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to load amenity booking details.')),
    );
  }

  Future<void> _bookFacility() async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty || _selectedFacilityId == null) {
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final response = await http.post(
        ApiConfig.uri('/facility/book'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'facilityId': _selectedFacilityId,
          'residentId': residentId,
          'bookingDate': _dateController.text.trim(),
          'timeSlot': _requiresTimeSlot ? _selectedTimeSlot : null,
        }),
      );

      if (!mounted) return;

      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;
      if (response.statusCode == 201 || response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Amenity request submitted for chairman approval.')),
        );
        _dateController.clear();
        setState(() {
          _selectedTimeSlot = null;
        });
        await _loadData();
        return;
      }

      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Failed to submit amenity request.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final initialDate = _selectedDate ?? now;
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 1),
    );

    if (pickedDate == null) return;

    setState(() {
      _selectedDate = pickedDate;
      _dateController.text = _formatDateForApi(pickedDate);
    });
    await _refreshAvailabilityHint();
  }

  String _formatDateForApi(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  Future<void> _refreshAvailabilityHint() async {
    final facilityId = _selectedFacilityId;
    final bookingDate = _dateController.text.trim();
    if (facilityId == null || facilityId.isEmpty || bookingDate.isEmpty) {
      if (!mounted) return;
      setState(() {
        _availabilityHint = null;
        _remainingCapacity = null;
        _isAvailabilityFull = false;
        _hasPendingConflict = false;
      });
      return;
    }

    if (_requiresTimeSlot && (_selectedTimeSlot == null || _selectedTimeSlot!.isEmpty)) {
      if (!mounted) return;
      setState(() {
        _availabilityHint = 'Select a gym timeslot to check remaining capacity.';
        _remainingCapacity = null;
        _isAvailabilityFull = false;
        _hasPendingConflict = false;
      });
      return;
    }

    final uri = ApiConfig.uri(
      '/facility/availability?facilityId=$facilityId&bookingDate=$bookingDate${_requiresTimeSlot ? '&timeSlot=${Uri.encodeQueryComponent(_selectedTimeSlot!)}' : ''}',
    );
    final response = await http.get(uri);
    if (!mounted) return;

    final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;
    if (response.statusCode == 200 && body is Map<String, dynamic>) {
      setState(() {
        _availabilityHint = body['hint']?.toString();
        _remainingCapacity = body['remainingCapacity'] as int?;
        _isAvailabilityFull = body['isFull'] == true;
        _hasPendingConflict = body['hasPendingConflict'] == true;
      });
      return;
    }

    setState(() {
      _availabilityHint = null;
      _remainingCapacity = null;
      _isAvailabilityFull = false;
      _hasPendingConflict = false;
    });
  }

  bool get _requiresTimeSlot {
    final facility = _facilities.firstWhere(
      (item) => item['id']?.toString() == _selectedFacilityId,
      orElse: () => <String, dynamic>{},
    );
    return facility['requiresTimeslot'] == true;
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending Approval';
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':
        return Colors.green;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Amenity Booking')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
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
                            'Raise Amenity Request',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            initialValue: _selectedFacilityId,
                            decoration: const InputDecoration(labelText: 'Amenity'),
                            items: _facilities
                                .map(
                                  (facility) => DropdownMenuItem<String>(
                                    value: facility['id']?.toString(),
                                    child: Text(
                                      '${facility['name']} (Capacity ${facility['capacity']})',
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) {
                              setState(() {
                                _selectedFacilityId = value;
                                _selectedTimeSlot = null;
                              });
                              _refreshAvailabilityHint();
                            },
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _dateController,
                            readOnly: true,
                            onTap: _pickDate,
                            decoration: const InputDecoration(
                              labelText: 'Booking Date',
                              suffixIcon: Icon(Icons.calendar_today_outlined),
                            ),
                          ),
                          if (_requiresTimeSlot) ...[
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              initialValue: _selectedTimeSlot,
                              decoration: const InputDecoration(labelText: 'Gym Timeslot'),
                              items: _gymTimeSlots
                                  .map(
                                    (slot) => DropdownMenuItem<String>(
                                      value: slot,
                                      child: Text(slot),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) {
                                setState(() {
                                  _selectedTimeSlot = value;
                                });
                                _refreshAvailabilityHint();
                              },
                            ),
                          ],
                          if (_availabilityHint != null) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: _isAvailabilityFull
                                    ? Colors.red.withOpacity(0.08)
                                    : _hasPendingConflict
                                    ? Colors.orange.withOpacity(0.08)
                                    : Colors.indigo.withOpacity(0.08),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _availabilityHint!,
                                    style: TextStyle(
                                      color: _isAvailabilityFull
                                          ? Colors.red
                                          : _hasPendingConflict
                                          ? Colors.orange
                                          : Colors.indigo,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (_remainingCapacity != null && _requiresTimeSlot) ...[
                                    const SizedBox(height: 4),
                                    Text('Remaining capacity: $_remainingCapacity'),
                                  ],
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: _isSubmitting || _isAvailabilityFull
                                ? null
                                : _bookFacility,
                            child: Text(
                              _isSubmitting ? 'Submitting...' : 'Request Booking',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'My Requests',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  ..._myRequests.map((item) {
                    final booking = Map<String, dynamic>.from(item as Map);
                    final status = booking['status']?.toString() ?? 'pending';
                    final color = _statusColor(status);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Card(
                        child: ListTile(
                          title: Text(booking['facility']?['name']?.toString() ?? 'Amenity'),
                          subtitle: Text(
                            '${booking['bookingDate']}${booking['timeSlot'] == null ? '' : ' • ${booking['timeSlot']}'}',
                          ),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}
