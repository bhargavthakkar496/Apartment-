import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'api_config.dart';

class NotificationsScreen extends StatefulWidget {
  final String residentId;

  const NotificationsScreen({super.key, required this.residentId});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> notifications = [];

  String _displayMessage(String rawMessage) {
    final match = RegExp(
      r'^\[repair-request:([^:\]]+):(pending|in_progress|resolved)\]\s*(.*)$',
      caseSensitive: false,
    ).firstMatch(rawMessage);

    if (match == null) {
      return rawMessage;
    }

    return match.group(3)?.trim().isNotEmpty == true
        ? match.group(3)!.trim()
        : 'Repair/problem request updated.';
  }

  @override
  void initState() {
    super.initState();
    fetchNotifications();
  }

  Future<void> fetchNotifications() async {
    final response = await http.get(
      ApiConfig.uri('/notifications/${widget.residentId}'),
    );

    if (response.statusCode == 200) {
      if (!mounted) return;
      setState(() {
        notifications = json.decode(response.body);
      });
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load notifications.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
      ),
      body: ListView.builder(
        itemCount: notifications.length,
        itemBuilder: (context, index) {
          final notification = notifications[index];
          return ListTile(
            title: Text(
              _displayMessage(notification['message']?.toString() ?? ''),
            ),
            subtitle: Text(notification['createdAt']),
          );
        },
      ),
    );
  }
}
