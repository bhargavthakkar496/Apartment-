import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'api_config.dart';

class ResidentDashboardScreen extends StatefulWidget {
  const ResidentDashboardScreen({super.key});

  @override
  State<ResidentDashboardScreen> createState() =>
      _ResidentDashboardScreenState();
}

class _ResidentDashboardScreenState extends State<ResidentDashboardScreen> {
  List<dynamic> _residents = [];

  @override
  void initState() {
    super.initState();
    _fetchResidents();
  }

  Future<void> _fetchResidents() async {
    final response = await http.get(ApiConfig.uri('/resident'));

    if (response.statusCode == 200) {
      if (!mounted) return;
      setState(() {
        _residents = jsonDecode(response.body);
      });
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load residents.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Resident Dashboard')),
      body: ListView.builder(
        itemCount: _residents.length,
        itemBuilder: (context, index) {
          final resident = _residents[index];
          return ListTile(
            title: Text(resident['name']),
            subtitle: Text('Flat: ${resident['flatNo']}'),
          );
        },
      ),
    );
  }
}
