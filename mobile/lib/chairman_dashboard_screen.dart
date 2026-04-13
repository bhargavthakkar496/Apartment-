import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'external_link_helper.dart';

class ChairmanDashboardScreen extends StatefulWidget {
  const ChairmanDashboardScreen({
    super.key,
    required this.residentId,
    this.residentName,
  });

  final String? residentId;
  final String? residentName;

  @override
  State<ChairmanDashboardScreen> createState() => _ChairmanDashboardScreenState();
}

class _ChairmanDashboardScreenState extends State<ChairmanDashboardScreen> {
  static const List<({String label, String? status})> _filters = [
    (label: 'All', status: null),
    (label: 'Pending', status: 'pending'),
    (label: 'Overdue', status: 'overdue'),
    (label: 'Collected', status: 'collected'),
  ];

  Map<String, dynamic>? _overview;
  List<Map<String, dynamic>> _announcements = [];
  bool _isLoading = true;
  bool _isLoadingAnnouncements = true;
  bool _isNotifyingAllPending = false;
  bool _isSubmittingAnnouncement = false;
  String? _busyPaymentId;
  int _selectedFilterIndex = 1;
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _announcementTitleController =
      TextEditingController();
  final TextEditingController _announcementContentController =
      TextEditingController();
  final Set<String> _selectedAnnouncementRoles = {'resident', 'owner'};

  @override
  void initState() {
    super.initState();
    _refreshDashboard();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _announcementTitleController.dispose();
    _announcementContentController.dispose();
    super.dispose();
  }

  Future<void> _refreshDashboard() async {
    await Future.wait([
      _fetchOverview(),
      _fetchAnnouncements(),
    ]);
  }

  Future<void> _fetchOverview() async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chairman details are unavailable.')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final response = await http.get(
      ApiConfig.uri('/maintenance/chairman/$residentId/overview'),
    );

    if (!mounted) return;

    if (response.statusCode == 200) {
      setState(() {
        _overview = jsonDecode(response.body) as Map<String, dynamic>;
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to load maintenance overview.')),
    );
  }

  Future<void> _fetchAnnouncements() async {
    setState(() {
      _isLoadingAnnouncements = true;
    });

    final response = await http.get(ApiConfig.uri('/announcements'));

    if (!mounted) return;

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body) as List<dynamic>;
      setState(() {
        _announcements = decoded
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        _isLoadingAnnouncements = false;
      });
      return;
    }

    setState(() {
      _isLoadingAnnouncements = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to load announcements.')),
    );
  }

  Future<void> _submitAnnouncement() async {
    if (_isSubmittingAnnouncement) return;

    final title = _announcementTitleController.text.trim();
    final content = _announcementContentController.text.trim();
    if (title.isEmpty || content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add both a title and message.')),
      );
      return;
    }

    if (_selectedAnnouncementRoles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one audience.')),
      );
      return;
    }

    setState(() {
      _isSubmittingAnnouncement = true;
    });

    try {
      final response = await http.post(
        ApiConfig.uri('/announcements'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'title': title,
          'content': content,
          'targetRoles': _selectedAnnouncementRoles.toList(),
          'createdByRole': 'chairman',
          'createdByName': widget.residentName ?? 'Chairman',
        }),
      );

      if (!mounted) return;

      if (response.statusCode == 200 || response.statusCode == 201) {
        _announcementTitleController.clear();
        _announcementContentController.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Announcement sent to ${_audienceSummary(_selectedAnnouncementRoles.toList())}.',
            ),
          ),
        );
        await _fetchAnnouncements();
        return;
      }

      final body =
          response.body.isNotEmpty ? jsonDecode(response.body) : null;
      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Unable to publish the announcement.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmittingAnnouncement = false;
        });
      }
    }
  }

  Future<void> _markCollected(String paymentId) async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty) return;

    setState(() {
      _busyPaymentId = paymentId;
    });

    try {
      final response = await http.post(
        ApiConfig.uri('/maintenance/chairman/$residentId/payments/$paymentId/collect'),
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Maintenance marked as collected.')),
        );
        await _fetchOverview();
        return;
      }

      final body =
          response.body.isNotEmpty ? jsonDecode(response.body) : null;
      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Unable to update maintenance status.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyPaymentId = null;
        });
      }
    }
  }

  Future<void> _notifyOnWhatsapp(String paymentId) async {
    final residentId = widget.residentId;
    if (residentId == null || residentId.isEmpty) return;

    setState(() {
      _busyPaymentId = paymentId;
    });

    try {
      final response = await http.get(
        ApiConfig.uri('/maintenance/chairman/$residentId/payments/$paymentId/whatsapp'),
      );

      if (!mounted) return;

      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;
      if (response.statusCode == 200 &&
          body is Map<String, dynamic> &&
          body['whatsappUrl'] != null) {
        await openExternalLink(body['whatsappUrl'].toString());
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Opening WhatsApp reminder for Flat ${body['flatNumber']}.',
            ),
          ),
        );
        return;
      }

      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Unable to open WhatsApp reminder.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This build could not open the WhatsApp link.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyPaymentId = null;
        });
      }
    }
  }

  Future<void> _notifyAllPending(List<Map<String, dynamic>> apartments) async {
    if (_isNotifyingAllPending) return;

    final pendingWithWhatsapp = apartments
        .where(
          (apartment) =>
              apartment['status']?.toString() == 'pending' &&
              apartment['whatsappUrl'] != null,
        )
        .toList();

    if (pendingWithWhatsapp.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No pending apartments with WhatsApp contacts are available.'),
        ),
      );
      return;
    }

    setState(() {
      _isNotifyingAllPending = true;
    });

    try {
      for (final apartment in pendingWithWhatsapp) {
        final url = apartment['whatsappUrl']?.toString();
        if (url == null || url.isEmpty) {
          continue;
        }
        await openExternalLink(url);
        await Future<void>.delayed(const Duration(milliseconds: 250));
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Opened WhatsApp reminders for ${pendingWithWhatsapp.length} pending apartments.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to open all WhatsApp reminders in this build.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isNotifyingAllPending = false;
        });
      }
    }
  }

  String _formatAmount(dynamic value) {
    final amount = value is num ? value.toInt() : int.tryParse('$value') ?? 0;
    return 'Rs $amount';
  }

  String _formatDateLabel(String? isoValue) {
    if (isoValue == null || isoValue.isEmpty) {
      return '-';
    }
    final parsed = DateTime.tryParse(isoValue);
    if (parsed == null) {
      return isoValue;
    }
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
    return '${parsed.day} ${months[parsed.month - 1]} ${parsed.year}';
  }

  String _formatDateTimeLabel(String? isoValue) {
    if (isoValue == null || isoValue.isEmpty) {
      return 'Just now';
    }

    final parsed = DateTime.tryParse(isoValue);
    if (parsed == null) {
      return isoValue;
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
    return '${local.day} ${months[local.month - 1]}, $hour:$minute $period';
  }

  String _roleAudienceLabel(String role) {
    switch (role) {
      case 'resident':
        return 'Tenant';
      case 'owner':
        return 'Owner';
      default:
        return role;
    }
  }

  String _audienceSummary(List<dynamic> roles) {
    final labels = roles
        .map((role) => _roleAudienceLabel(role?.toString() ?? ''))
        .where((label) => label.isNotEmpty)
        .toList();

    if (labels.isEmpty) {
      return 'the community';
    }
    if (labels.length == 1) {
      return labels.first;
    }
    return '${labels.first} and ${labels.last}';
  }

  List<Map<String, dynamic>> _filteredApartments(List<Map<String, dynamic>> apartments) {
    final selectedStatus = _filters[_selectedFilterIndex].status;
    final query = _searchController.text.trim().toLowerCase();

    return apartments.where((apartment) {
      final matchesStatus =
          selectedStatus == null ||
          apartment['status']?.toString() == selectedStatus;
      final flatNumber = apartment['flatNumber']?.toString().toLowerCase() ?? '';
      final matchesSearch = query.isEmpty || flatNumber.contains(query);
      return matchesStatus && matchesSearch;
    }).toList();
  }

  Future<void> _openApartmentDetails(Map<String, dynamic> apartment) async {
    final status = apartment['status']?.toString() ?? 'pending';
    final paymentId = apartment['id']?.toString() ?? '';
    final contactName = apartment['contactName']?.toString();
    final contactPhone = apartment['contactPhone']?.toString();
    final details = <String>[
      'Flat ${apartment['flatNumber']}',
      _formatAmount(apartment['amount']),
      if (contactName != null && contactName.isNotEmpty) 'Contact: $contactName',
      if (contactPhone != null && contactPhone.isNotEmpty) contactPhone,
    ];

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final isBusy = _busyPaymentId == paymentId;
            final currentStatus = apartment['status']?.toString() ?? status;
            final currentCollected = currentStatus == 'collected';
            final statusColor = switch (currentStatus) {
              'collected' => Colors.green,
              'overdue' => Colors.deepOrange,
              _ => Colors.red,
            };

            Future<void> markCollectedFromSheet() async {
              Navigator.of(context).pop();
              await _markCollected(paymentId);
            }

            Future<void> notifyFromSheet() async {
              setSheetState(() {});
              Navigator.of(context).pop();
              await _notifyOnWhatsapp(paymentId);
            }

            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Apartment ${apartment['flatNumber']}',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: details
                          .map(
                            (detail) => Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.04),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(detail),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _statusLabel(currentStatus),
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: currentCollected || isBusy
                            ? null
                            : markCollectedFromSheet,
                        child: Text(
                          isBusy ? 'Updating...' : 'Mark Collected',
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: currentCollected ||
                                isBusy ||
                                apartment['whatsappUrl'] == null
                            ? null
                            : notifyFromSheet,
                        icon: const Icon(Icons.message_outlined),
                        label: const Text('Notify on WhatsApp'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chairman Dashboard')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final overview = _overview;
    if (overview == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chairman Dashboard')),
        body: const Center(child: Text('No maintenance data available.')),
      );
    }

    final apartments =
        (overview['apartments'] as List<dynamic>? ?? <dynamic>[])
            .cast<Map<String, dynamic>>();
    final filteredApartments = _filteredApartments(apartments);
    final collectedApartments = overview['collectedApartments'] as int? ?? 0;
    final pendingApartments = overview['pendingApartments'] as int? ?? 0;
    final overdueApartments = overview['overdueApartments'] as int? ?? 0;
    final chairmanNumber =
        overview['chairmanWhatsappNumber']?.toString() ?? '';
    final cycleStartDate = _formatDateLabel(overview['cycleStartDate']?.toString());
    final dueDate = _formatDateLabel(overview['dueDate']?.toString());
    final isOverdueWindowOpen = overview['isOverdueWindowOpen'] == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Chairman Dashboard')),
      body: RefreshIndicator(
        onRefresh: _refreshDashboard,
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
                      overview['society']?['name']?.toString() ?? 'Society',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text('Cycle: ${overview['cycleMonth']}'),
                    Text('Collection window: $cycleStartDate to $dueDate'),
                    Text(
                      isOverdueWindowOpen
                          ? 'Status window: dues after 7th are now marked overdue.'
                          : 'Status window: dues remain pending until the 7th.',
                    ),
                    Text('Maintenance per apartment: ${_formatAmount(overview['maintenancePerApartment'])}'),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _AmountCard(
                            label: 'Total To Collect',
                            value: _formatAmount(overview['totalToBeCollected']),
                            color: Colors.indigo,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _AmountCard(
                            label: 'Collected',
                            value: _formatAmount(overview['totalCollected']),
                            color: Colors.green,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _AmountCard(
                            label: 'Pending',
                            value: _formatAmount(overview['totalPending']),
                            color: Colors.red,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Center(
                      child: _MaintenancePieChart(
                        collectedCount: collectedApartments,
                        pendingCount: pendingApartments,
                        overdueCount: overdueApartments,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: const [
                        _LegendChip(color: Colors.green, label: 'Green = maintenance collected'),
                        _LegendChip(color: Colors.red, label: 'Red = maintenance pending'),
                        _LegendChip(color: Colors.deepOrange, label: 'Orange = maintenance overdue'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        _StatusCountChip(
                          color: Colors.red,
                          label: 'Pending',
                          count: pendingApartments,
                        ),
                        _StatusCountChip(
                          color: Colors.deepOrange,
                          label: 'Overdue',
                          count: overdueApartments,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'WhatsApp reminders include hardcoded chairman contact: +$chairmanNumber',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
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
                      'Push Announcements',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      widget.residentName == null
                          ? 'Create notices for owners and tenants from the chairman desk.'
                          : '${widget.residentName} can publish targeted updates for owners and tenants.',
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _announcementTitleController,
                      decoration: const InputDecoration(
                        labelText: 'Announcement title',
                        hintText: 'Water tank cleaning on Saturday',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _announcementContentController,
                      minLines: 3,
                      maxLines: 5,
                      decoration: const InputDecoration(
                        labelText: 'Message',
                        hintText:
                            'Share the update, timing, and any action residents should take.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Target audience',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        for (final role in const ['resident', 'owner'])
                          FilterChip(
                            label: Text(_roleAudienceLabel(role)),
                            selected: _selectedAnnouncementRoles.contains(role),
                            onSelected: (selected) {
                              setState(() {
                                if (selected) {
                                  _selectedAnnouncementRoles.add(role);
                                } else {
                                  _selectedAnnouncementRoles.remove(role);
                                }
                              });
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _isSubmittingAnnouncement
                            ? null
                            : _submitAnnouncement,
                        icon: const Icon(Icons.campaign_outlined),
                        label: Text(
                          _isSubmittingAnnouncement
                              ? 'Publishing...'
                              : 'Push Announcement',
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Recent Announcements',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        if (_announcements.isNotEmpty)
                          Text(
                            '${_announcements.length} total',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_isLoadingAnnouncements)
                      const Center(child: CircularProgressIndicator())
                    else if (_announcements.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.04),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Text(
                          'No announcements published yet. Create one for tenants or owners to preview the flow.',
                        ),
                      )
                    else
                      ..._announcements.take(4).map((announcement) {
                        final roles =
                            announcement['targetRoles'] as List<dynamic>? ??
                                <dynamic>[];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.indigo.withOpacity(0.06),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  announcement['title']?.toString() ??
                                      'Untitled announcement',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 6),
                                Text(announcement['content']?.toString() ?? ''),
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        'For ${_audienceSummary(roles)}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        _formatDateTimeLabel(
                                          announcement['createdAt']?.toString(),
                                        ),
                                      ),
                                    ),
                                  ],
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
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Apartment Status',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(
                  '${filteredApartments.length} shown',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _searchController,
              decoration: InputDecoration(
                labelText: 'Search flat number',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _searchController.clear();
                          setState(() {});
                        },
                        icon: const Icon(Icons.close),
                        tooltip: 'Clear search',
                      ),
              ),
              keyboardType: TextInputType.number,
              onChanged: (_) {
                setState(() {});
              },
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: List.generate(_filters.length, (index) {
                  final filter = _filters[index];
                  final isSelected = index == _selectedFilterIndex;
                  return Padding(
                    padding: EdgeInsets.only(
                      right: index == _filters.length - 1 ? 0 : 10,
                    ),
                    child: ChoiceChip(
                      label: Text(filter.label),
                      selected: isSelected,
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
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: _isNotifyingAllPending
                    ? null
                    : () => _notifyAllPending(apartments),
                icon: const Icon(Icons.campaign_outlined),
                label: Text(
                  _isNotifyingAllPending
                      ? 'Opening WhatsApp...'
                      : 'Notify All Pending',
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (filteredApartments.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'No apartments match this filter right now.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              LayoutBuilder(
                builder: (context, constraints) {
                  final width = constraints.maxWidth;
                  final crossAxisCount = width >= 900
                      ? 5
                      : width >= 680
                      ? 4
                      : width >= 480
                      ? 3
                      : 2;

                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filteredApartments.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: crossAxisCount,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.08,
                    ),
                    itemBuilder: (context, index) {
                      final apartment = filteredApartments[index];
                      final status = apartment['status']?.toString() ?? 'pending';
                      final paymentId = apartment['id']?.toString() ?? '';
                      final contactName = apartment['contactName']?.toString();

                      return _ApartmentTile(
                        flatNumber: apartment['flatNumber']?.toString() ?? '-',
                        label: _statusLabel(status),
                        contactName: contactName,
                        status: status,
                        isBusy: _busyPaymentId == paymentId,
                        onTap: () => _openApartmentDetails(apartment),
                      );
                    },
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'collected':
        return 'Collected';
      case 'overdue':
        return 'Overdue';
      default:
        return 'Pending';
    }
  }
}

class _AmountCard extends StatelessWidget {
  const _AmountCard({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({
    required this.color,
    required this.label,
  });

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(label),
        ],
      ),
    );
  }
}

class _StatusCountChip extends StatelessWidget {
  const _StatusCountChip({
    required this.color,
    required this.label,
    required this.count,
  });

  final Color color;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$label: $count',
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ApartmentTile extends StatelessWidget {
  const _ApartmentTile({
    required this.flatNumber,
    required this.label,
    required this.contactName,
    required this.status,
    required this.isBusy,
    required this.onTap,
  });

  final String flatNumber;
  final String label;
  final String? contactName;
  final String status;
  final bool isBusy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final baseColor = switch (status) {
      'collected' => Colors.green,
      'overdue' => Colors.deepOrange,
      _ => Colors.red,
    };

    return Material(
      color: baseColor.withOpacity(0.10),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      flatNumber,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (isBusy)
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: baseColor,
                      ),
                    ),
                ],
              ),
              const Spacer(),
              Text(
                label,
                style: TextStyle(
                  color: baseColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                contactName == null || contactName!.isEmpty
                    ? 'Tap for actions'
                    : contactName!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MaintenancePieChart extends StatelessWidget {
  const _MaintenancePieChart({
    required this.collectedCount,
    required this.pendingCount,
    required this.overdueCount,
  });

  final int collectedCount;
  final int pendingCount;
  final int overdueCount;

  @override
  Widget build(BuildContext context) {
    final total = collectedCount + pendingCount + overdueCount;

    return Column(
      children: [
        SizedBox(
          width: 200,
          height: 200,
          child: CustomPaint(
            painter: _PiePainter(
              collectedFraction: total == 0 ? 0 : collectedCount / total,
              pendingFraction: total == 0 ? 0 : pendingCount / total,
              overdueFraction: total == 0 ? 0 : overdueCount / total,
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$total',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  const Text('Apartments'),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '$collectedCount collected • $pendingCount pending • $overdueCount overdue',
        ),
      ],
    );
  }
}

class _PiePainter extends CustomPainter {
  const _PiePainter({
    required this.collectedFraction,
    required this.pendingFraction,
    required this.overdueFraction,
  });

  final double collectedFraction;
  final double pendingFraction;
  final double overdueFraction;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final startAngle = -math.pi / 2;
    final collectedSweep = 2 * math.pi * collectedFraction;
    final pendingSweep = 2 * math.pi * pendingFraction;
    final overdueSweep = 2 * math.pi * overdueFraction;
    final strokeWidth = math.min(size.width, size.height) * 0.22;

    final basePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    final collectedPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = Colors.green;
    final pendingPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = Colors.red;
    final overduePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = Colors.deepOrange;

    final chartRect = rect.deflate(strokeWidth / 2);
    var currentStartAngle = startAngle;

    if (collectedSweep > 0) {
      canvas.drawArc(chartRect, currentStartAngle, collectedSweep, false, collectedPaint);
      currentStartAngle += collectedSweep;
    }

    if (pendingSweep > 0) {
      canvas.drawArc(chartRect, currentStartAngle, pendingSweep, false, pendingPaint);
      currentStartAngle += pendingSweep;
    }

    if (overdueSweep > 0) {
      canvas.drawArc(chartRect, currentStartAngle, overdueSweep, false, overduePaint);
    }

    if (collectedSweep == 0 && pendingSweep == 0 && overdueSweep == 0) {
      canvas.drawArc(chartRect, startAngle, 2 * math.pi, false, basePaint..color = Colors.grey.shade300);
    }
  }

  @override
  bool shouldRepaint(covariant _PiePainter oldDelegate) {
    return oldDelegate.collectedFraction != collectedFraction ||
        oldDelegate.pendingFraction != pendingFraction ||
        oldDelegate.overdueFraction != overdueFraction;
  }
}
