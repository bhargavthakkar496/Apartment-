import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

class ChairmanRepairRequestsScreen extends StatefulWidget {
  const ChairmanRepairRequestsScreen({
    super.key,
    required this.residentId,
  });

  final String? residentId;

  @override
  State<ChairmanRepairRequestsScreen> createState() =>
      _ChairmanRepairRequestsScreenState();
}

class _ChairmanRepairRequestsScreenState
    extends State<ChairmanRepairRequestsScreen> {
  static const List<({String label, String? status})> _filters = [
    (label: 'Pending', status: 'pending'),
    (label: 'In Progress', status: 'in_progress'),
    (label: 'Resolved', status: 'resolved'),
    (label: 'All', status: null),
  ];

  Map<String, dynamic>? _payload;
  bool _isLoading = true;
  String? _busyRequestId;
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
      ApiConfig.uri('/maintenance/chairman/$residentId/requests'),
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
      const SnackBar(content: Text('Failed to load repair requests.')),
    );
  }

  Future<String?> _promptForMessage({
    required String title,
    required String hint,
    String initialValue = '',
  }) async {
    final controller = TextEditingController(text: initialValue);
    final value = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(title),
          content: TextField(
            controller: controller,
            minLines: 2,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: hint,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(controller.text.trim()),
              child: const Text('Send'),
            ),
          ],
        );
      },
    );
    controller.dispose();
    return value;
  }

  Future<void> _performAction({
    required String requestId,
    required String action,
    String? message,
  }) async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty) return;

    setState(() {
      _busyRequestId = requestId;
    });

    try {
      final response = await http.post(
        ApiConfig.uri('/maintenance/chairman/$residentId/requests/$requestId/$action'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          if (message != null) 'message': message,
        }),
      );

      if (!mounted) return;

      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'start'
                  ? 'Repair request marked as in progress.'
                  : action == 'resolve'
                  ? 'Repair request marked as resolved.'
                  : 'Repair update sent to the resident.',
            ),
          ),
        );
        await _loadRequests();
        return;
      }

      final errorMessage = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Unable to update repair request.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(errorMessage)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyRequestId = null;
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
      case 'resolved':
        return Colors.green;
      case 'in_progress':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'resolved':
        return 'Resolved';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Pending';
    }
  }

  String _formatTimestamp(String? value) {
    if (value == null || value.isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return '${parsed.day}/${parsed.month}/${parsed.year} ${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Repair Requests')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final payload = _payload;
    final items = (payload?['items'] as List<dynamic>? ?? <dynamic>[])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final filteredItems = _filteredItems(items);

    return Scaffold(
      appBar: AppBar(title: const Text('Repair Requests')),
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
            if (filteredItems.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'No repair/problem requests match this filter right now.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ...filteredItems.map((item) {
                final status = item['status']?.toString() ?? 'pending';
                final requestId = item['id']?.toString() ?? '';
                final isBusy = _busyRequestId == requestId;
                final updates = (item['updates'] as List<dynamic>? ?? <dynamic>[])
                    .map((entry) => Map<String, dynamic>.from(entry as Map))
                    .toList();

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item['description']?.toString() ?? 'Repair request',
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: _statusColor(status).withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  _statusLabel(status),
                                  style: TextStyle(
                                    color: _statusColor(status),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${item['requesterRole']} ${item['requesterName']} • Flat ${item['flatNumber']}',
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Last updated: ${_formatTimestamp(item['latestUpdatedAt']?.toString())}',
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item['latestUpdate']?.toString() ?? 'No updates sent yet.',
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              if (status == 'pending')
                                FilledButton(
                                  onPressed: isBusy
                                      ? null
                                      : () async {
                                          final message = await _promptForMessage(
                                            title: 'Start Work',
                                            hint: 'Optional message for the resident',
                                            initialValue:
                                                'The chairman has started working on your repair/problem request.',
                                          );
                                          if (message == null) return;
                                          await _performAction(
                                            requestId: requestId,
                                            action: 'start',
                                            message: message,
                                          );
                                        },
                                  child: Text(isBusy ? 'Updating...' : 'Start Work'),
                                ),
                              OutlinedButton(
                                onPressed: isBusy || status == 'resolved'
                                    ? null
                                    : () async {
                                        final message = await _promptForMessage(
                                          title: 'Send Update',
                                          hint: 'Share the latest progress',
                                        );
                                        if (message == null || message.isEmpty) return;
                                        await _performAction(
                                          requestId: requestId,
                                          action: 'update',
                                          message: message,
                                        );
                                      },
                                child: const Text('Send Update'),
                              ),
                              OutlinedButton(
                                onPressed: isBusy || status == 'resolved'
                                    ? null
                                    : () async {
                                        final message = await _promptForMessage(
                                          title: 'Resolve Request',
                                          hint: 'Optional closing note for the resident',
                                          initialValue:
                                              'Your repair/problem request has been resolved by the chairman.',
                                        );
                                        if (message == null) return;
                                        await _performAction(
                                          requestId: requestId,
                                          action: 'resolve',
                                          message: message,
                                        );
                                      },
                                child: const Text('Resolve'),
                              ),
                            ],
                          ),
                          if (updates.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text(
                              'Timeline',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            const SizedBox(height: 8),
                            ...updates.map(
                              (update) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 10,
                                      height: 10,
                                      margin: const EdgeInsets.only(top: 6),
                                      decoration: BoxDecoration(
                                        color: _statusColor(
                                          update['status']?.toString() ?? 'pending',
                                        ),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            update['message']?.toString() ?? 'Update sent',
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            _formatTimestamp(
                                              update['createdAt']?.toString(),
                                            ),
                                            style: Theme.of(context).textTheme.bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
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
