import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'api_config.dart';

class MaintenanceRequestsScreen extends StatefulWidget {
  const MaintenanceRequestsScreen({super.key});

  @override
  State<MaintenanceRequestsScreen> createState() =>
      _MaintenanceRequestsScreenState();
}

class _MaintenanceRequestsScreenState extends State<MaintenanceRequestsScreen> {
  final TextEditingController _descriptionController = TextEditingController();
  List<dynamic> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    final response = await http.get(ApiConfig.uri('/maintenance'));

    if (response.statusCode == 200) {
      if (!mounted) return;
      setState(() {
        _requests = jsonDecode(response.body);
      });
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load maintenance requests.')),
      );
    }
  }

  Future<void> _createRequest() async {
    final response = await http.post(
      ApiConfig.uri('/maintenance'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'description': _descriptionController.text,
        'residentId': 'resident-id-placeholder',
      }),
    );

    if (response.statusCode == 200) {
      _fetchRequests();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maintenance request created successfully!')),
      );
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to create maintenance request.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Maintenance Requests')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'Request Description'),
            ),
          ),
          ElevatedButton(
            onPressed: _createRequest,
            child: const Text('Submit Request'),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: ListView.builder(
              itemCount: _requests.length,
              itemBuilder: (context, index) {
                final request = _requests[index];
                return ListTile(
                  title: Text(request['description']),
                  subtitle: Text('Status: ${request['status']}'),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }
}
