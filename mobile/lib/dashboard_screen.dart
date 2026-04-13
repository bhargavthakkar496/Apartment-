import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.role,
    this.residentName,
  });

  final String role;
  final String? residentName;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Map<String, dynamic>> _announcements = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchAnnouncements();
  }

  bool get _isChairman => widget.role == 'chairman';

  Future<void> _fetchAnnouncements() async {
    setState(() {
      _isLoading = true;
    });

    final queryParameters = !_isChairman &&
            (widget.role == 'resident' || widget.role == 'owner')
        ? {'role': widget.role}
        : null;

    final response = await http.get(
      ApiConfig.uri('/announcements').replace(queryParameters: queryParameters),
    );

    if (!mounted) return;

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body) as List<dynamic>;
      setState(() {
        _announcements = decoded
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to load announcements.')),
    );
  }

  String _audienceLabel(List<dynamic> roles) {
    final labels = roles
        .map((role) => _roleLabel(role?.toString() ?? ''))
        .where((label) => label.isNotEmpty)
        .toList();
    return labels.isEmpty ? 'All residents' : labels.join(' and ');
  }

  String _roleLabel(String role) {
    switch (role) {
      case 'resident':
        return 'Tenants';
      case 'owner':
        return 'Owners';
      case 'chairman':
        return 'Chairman';
      default:
        return role.isEmpty ? '' : role;
    }
  }

  String _formatTimestamp(String? value) {
    if (value == null || value.isEmpty) {
      return 'Just now';
    }

    final parsed = DateTime.tryParse(value);
    if (parsed == null) {
      return value;
    }

    final local = parsed.toLocal();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final hour = local.hour == 0 ? 12 : (local.hour > 12 ? local.hour - 12 : local.hour);
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day} ${months[local.month - 1]} ${local.year}, $hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    final title = _isChairman ? 'Announcements Feed' : 'Announcements';
    final subtitle = _isChairman
        ? 'Review recent notices sent to owners and tenants.'
        : 'Updates targeted to your role appear here.';

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: RefreshIndicator(
        onRefresh: _fetchAnnouncements,
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
                      widget.residentName == null
                          ? subtitle
                          : 'Hello ${widget.residentName}, $subtitle',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isChairman
                          ? 'Use the chairman dashboard to create and push new announcements.'
                          : 'This list is filtered for ${_roleLabel(widget.role).toLowerCase()}.',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_announcements.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.04),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _isChairman
                      ? 'No announcements have been posted yet.'
                      : 'No announcements are available for your role right now.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ..._announcements.map((announcement) {
                final targetRoles =
                    (announcement['targetRoles'] as List<dynamic>? ?? <dynamic>[]);
                final createdByName = announcement['createdByName']?.toString();
                final createdByRole = announcement['createdByRole']?.toString();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.indigo.withOpacity(0.10),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  'For ${_audienceLabel(targetRoles)}',
                                  style: const TextStyle(
                                    color: Colors.indigo,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.05),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(_formatTimestamp(announcement['createdAt']?.toString())),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            announcement['title']?.toString() ?? 'Untitled announcement',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Text(announcement['content']?.toString() ?? ''),
                          const SizedBox(height: 12),
                          Text(
                            createdByName == null || createdByName.isEmpty
                                ? 'Posted by ${_roleLabel(createdByRole ?? '')}'
                                : 'Posted by $createdByName',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
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
