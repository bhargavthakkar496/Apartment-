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
            title: Text(notification['message']),
            subtitle: Text(notification['createdAt']),
          );
        },
      ),
    );
  }
}
