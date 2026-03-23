import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_screen.dart';

class ResidentDashboardScreen extends StatefulWidget {
  const ResidentDashboardScreen({
    super.key,
    required this.residentId,
    required this.role,
  });

  final String? residentId;
  final String role;

  @override
  State<ResidentDashboardScreen> createState() =>
      _ResidentDashboardScreenState();
}

class _ResidentDashboardScreenState extends State<ResidentDashboardScreen> {
  Map<String, dynamic>? _tenant;
  List<Map<String, dynamic>> _repairRequests = [];
  bool _isMovingOut = false;
  bool _isLoadingRequests = true;
  bool _isSubmittingRequest = false;
  final TextEditingController _requestController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchTenant();
    _fetchRepairRequests();
  }

  @override
  void dispose() {
    _requestController.dispose();
    super.dispose();
  }

  Future<void> _fetchTenant() async {
    if (widget.residentId == null || widget.residentId!.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tenant details are unavailable.')),
      );
      return;
    }

    final response = await http.get(
      ApiConfig.uri('/resident/${widget.residentId}'),
    );

    if (response.statusCode == 200) {
      if (!mounted) return;
      setState(() {
        _tenant = jsonDecode(response.body) as Map<String, dynamic>;
      });
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load tenants.')),
      );
    }
  }

  Future<void> _fetchRepairRequests() async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _isLoadingRequests = false;
      });
      return;
    }

    final response = await http.get(
      ApiConfig.uri('/maintenance/resident/$residentId'),
    );

    if (!mounted) return;

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body) as List<dynamic>;
      setState(() {
        _repairRequests = body
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        _isLoadingRequests = false;
      });
      return;
    }

    setState(() {
      _isLoadingRequests = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to load repair requests.')),
    );
  }

  Future<void> _submitRepairRequest() async {
    final residentId = widget.residentId?.trim() ?? '';
    final description = _requestController.text.trim();

    if (_isSubmittingRequest) return;
    if (residentId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resident details are unavailable.')),
      );
      return;
    }

    if (description.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Describe the repair/problem first.')),
      );
      return;
    }

    setState(() {
      _isSubmittingRequest = true;
    });

    try {
      final response = await http.post(
        ApiConfig.uri('/maintenance'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'description': description,
          'residentId': residentId,
        }),
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        _requestController.clear();
        await _fetchRepairRequests();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Repair/problem request sent to the chairman.'),
          ),
        );
        return;
      }

      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;
      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Failed to create repair/problem request.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmittingRequest = false;
        });
      }
    }
  }

  Future<void> _moveOut() async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty || _isMovingOut) {
      return;
    }

    setState(() {
      _isMovingOut = true;
    });

    try {
      final response = await http.post(ApiConfig.uri('/resident/$residentId/move-out'));
      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;

      if (!mounted) return;

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Move-out recorded. This apartment is now available again.'),
          ),
        );
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AuthScreen()),
          (_) => false,
        );
        return;
      }

      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Unable to complete move-out right now.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isMovingOut = false;
        });
      }
    }
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
    if (value == null || value.isEmpty) {
      return '-';
    }

    final parsed = DateTime.tryParse(value);
    if (parsed == null) {
      return value;
    }

    return '${parsed.day}/${parsed.month}/${parsed.year} ${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final tenant = _tenant;
    final isActive = tenant?['isActive'] != false;
    final personLabel = widget.role == 'owner' ? 'Owner' : 'Tenant';
    final moveOutLabel = widget.role == 'owner' ? 'Release Apartment Listing' : 'Mark as Moved Out';

    return Scaffold(
      appBar: AppBar(title: const Text('My Apartment')),
      body: tenant == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                await _fetchTenant();
                await _fetchRepairRequests();
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: ListTile(
                      title: Text(tenant['name']?.toString() ?? personLabel),
                      subtitle: Text('Flat: ${tenant['flatNo'] ?? '-'}'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      title: const Text('Society'),
                      subtitle: Text(
                        tenant['society']?['name']?.toString() ?? 'Not available',
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      title: const Text('Status'),
                      subtitle: Text(
                        isActive ? 'Active apartment association' : 'Moved out / inactive',
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Repair / Problem Requests',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Raise an issue here and track updates from the chairman.',
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _requestController,
                            minLines: 2,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              labelText: 'Describe the repair or problem',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: FilledButton(
                              onPressed: _isSubmittingRequest ? null : _submitRepairRequest,
                              child: Text(
                                _isSubmittingRequest ? 'Sending...' : 'Send to Chairman',
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (_isLoadingRequests)
                            const Center(child: CircularProgressIndicator())
                          else if (_repairRequests.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12),
                              child: Text('No repair/problem requests raised yet.'),
                            )
                          else
                            ..._repairRequests.map((request) {
                              final status = request['status']?.toString() ?? 'pending';
                              final updates =
                                  (request['updates'] as List<dynamic>? ?? <dynamic>[])
                                      .map((item) => Map<String, dynamic>.from(item as Map))
                                      .toList();

                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: _statusColor(status).withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: ExpansionTile(
                                    tilePadding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 6,
                                    ),
                                    childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                    title: Text(
                                      request['description']?.toString() ?? 'Repair request',
                                    ),
                                    subtitle: Text(
                                      'Status: ${_statusLabel(status)}',
                                    ),
                                    trailing: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _statusColor(status).withOpacity(0.14),
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
                                    children: [
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: Text(
                                          'Latest update: ${request['latestUpdate']?.toString() ?? 'No updates yet.'}',
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: Text(
                                          'Last updated: ${_formatTimestamp(request['latestUpdatedAt']?.toString())}',
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      if (updates.isEmpty)
                                        const Align(
                                          alignment: Alignment.centerLeft,
                                          child: Text('No updates yet.'),
                                        )
                                      else
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
                                                        update['message']?.toString() ??
                                                            'Request updated',
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        _formatTimestamp(
                                                          update['createdAt']?.toString(),
                                                        ),
                                                        style: Theme.of(context)
                                                            .textTheme
                                                            .bodySmall,
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.tonal(
                    onPressed: !isActive || _isMovingOut ? null : _moveOut,
                    child: Text(_isMovingOut ? 'Processing...' : moveOutLabel),
                  ),
                ],
              ),
            ),
    );
  }
}
