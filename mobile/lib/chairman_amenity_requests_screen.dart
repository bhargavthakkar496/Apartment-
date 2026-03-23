import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

class ChairmanAmenityRequestsScreen extends StatefulWidget {
  const ChairmanAmenityRequestsScreen({
    super.key,
    required this.residentId,
  });

  final String? residentId;

  @override
  State<ChairmanAmenityRequestsScreen> createState() =>
      _ChairmanAmenityRequestsScreenState();
}

class _ChairmanAmenityRequestsScreenState
    extends State<ChairmanAmenityRequestsScreen> {
  static const List<({String label, String? status})> _filters = [
    (label: 'Pending', status: 'pending'),
    (label: 'Approved', status: 'approved'),
    (label: 'Rejected', status: 'rejected'),
    (label: 'All', status: null),
  ];

  Map<String, dynamic>? _payload;
  bool _isLoading = true;
  String? _busyBookingId;
  int _selectedFilterIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
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

    final response = await http.get(
      ApiConfig.uri('/facility/chairman/$residentId/requests'),
    );

    if (!mounted) return;

    if (response.statusCode == 200) {
      setState(() {
        _payload = jsonDecode(response.body) as Map<String, dynamic>;
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to load amenity requests.')),
    );
  }

  Future<void> _updateRequest(String bookingId, String action) async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty) return;

    setState(() {
      _busyBookingId = bookingId;
    });

    try {
      final response = await http.post(
        ApiConfig.uri('/facility/chairman/$residentId/requests/$bookingId/$action'),
      );

      if (!mounted) return;

      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'approve'
                  ? 'Amenity request approved.'
                  : 'Amenity request rejected.',
            ),
          ),
        );
        await _loadRequests();
        return;
      }

      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Unable to update amenity request.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyBookingId = null;
        });
      }
    }
  }

  List<Map<String, dynamic>> _filteredItems(List<Map<String, dynamic>> items) {
    final selectedStatus = _filters[_selectedFilterIndex].status;
    if (selectedStatus == null) {
      return items;
    }
    return items
        .where((item) => item['status']?.toString() == selectedStatus)
        .toList();
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

  String _statusLabel(String status) {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending';
    }
  }

  Map<String, List<Map<String, dynamic>>> _groupedItems(
    List<Map<String, dynamic>> items,
  ) {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final bookingDate = item['bookingDate']?.toString() ?? 'Unknown Date';
      final slotLabel = item['timeSlot']?.toString() ?? 'All-day';
      final key = '$bookingDate|$slotLabel';
      grouped.putIfAbsent(key, () => <Map<String, dynamic>>[]).add(item);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Amenity Approvals')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final payload = _payload;
    final items = (payload?['items'] as List<dynamic>? ?? <dynamic>[])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final filteredItems = _filteredItems(items);
    final groupedItems = _groupedItems(filteredItems);

    return Scaffold(
      appBar: AppBar(title: const Text('Amenity Approvals')),
      body: RefreshIndicator(
        onRefresh: _loadRequests,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (payload?['society'] != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    payload!['society']['name']?.toString() ?? 'Society',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: List.generate(_filters.length, (index) {
                  final filter = _filters[index];
                  return Padding(
                    padding: EdgeInsets.only(
                      right: index == _filters.length - 1 ? 0 : 10,
                    ),
                    child: ChoiceChip(
                      label: Text(filter.label),
                      selected: _selectedFilterIndex == index,
                      onSelected: (_) {
                        setState(() {
                          _selectedFilterIndex = index;
                        });
                      },
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 16),
            ...groupedItems.entries.map((entry) {
              final segments = entry.key.split('|');
              final bookingDate = segments.first;
              final slotLabel = segments.length > 1 ? segments[1] : 'All-day';

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: ExpansionTile(
                    initiallyExpanded: _selectedFilterIndex == 0,
                    title: Text(bookingDate),
                    subtitle: Text(slotLabel),
                    children: entry.value.map((item) {
                      final status = item['status']?.toString() ?? 'pending';
                      final color = _statusColor(status);
                      final bookingId = item['id']?.toString() ?? '';
                      final isBusy = _busyBookingId == bookingId;

                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item['amenityName']?.toString() ?? 'Amenity',
                                      style: Theme.of(context).textTheme.titleMedium,
                                    ),
                                  ),
                                  Container(
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
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${item['requesterRole']} ${item['requesterName']} • Flat ${item['flatNumber']}',
                              ),
                              const SizedBox(height: 4),
                              Text(
                                item['requiresTimeslot'] == true
                                    ? 'Capacity ${item['capacity']} for this timeslot'
                                    : 'Single approval per date',
                              ),
                              if (status == 'pending') ...[
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 10,
                                  runSpacing: 10,
                                  children: [
                                    FilledButton(
                                      onPressed: isBusy
                                          ? null
                                          : () => _updateRequest(bookingId, 'approve'),
                                      child: Text(
                                        isBusy ? 'Updating...' : 'Approve',
                                      ),
                                    ),
                                    OutlinedButton(
                                      onPressed: isBusy
                                          ? null
                                          : () => _updateRequest(bookingId, 'reject'),
                                      child: const Text('Reject'),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              );
            }),
            if (filteredItems.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'No amenity requests match this filter right now.',
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
