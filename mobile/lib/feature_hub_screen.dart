import 'package:flutter/material.dart';

import 'auth_screen.dart';
import 'chairman_amenity_requests_screen.dart';
import 'chairman_dashboard_screen.dart';
import 'chairman_repair_requests_screen.dart';
import 'dashboard_screen.dart';
import 'facility_booking_screen.dart';
import 'notifications_screen.dart';
import 'resident_dashboard_screen.dart';

class FeatureHubScreen extends StatelessWidget {
  const FeatureHubScreen({
    super.key,
    required this.role,
    this.residentId,
    this.residentName,
  });

  final String role;
  final String? residentId;
  final String? residentName;

  @override
  Widget build(BuildContext context) {
    final isChairman = role == 'chairman';
    final features = <({String title, Widget screen})>[
      if (isChairman)
        (
          title: 'Maintenance Overview',
          screen: ChairmanDashboardScreen(residentId: residentId),
        ),
      if (isChairman)
        (
          title: 'Amenity Approvals',
          screen: ChairmanAmenityRequestsScreen(residentId: residentId),
        ),
      if (isChairman)
        (
          title: 'Repair Requests',
          screen: ChairmanRepairRequestsScreen(residentId: residentId),
        ),
      (title: 'Announcements', screen: const DashboardScreen()),
      (
        title: 'Facility Booking',
        screen: FacilityBookingScreen(residentId: residentId),
      ),
      (
        title: 'My Apartment',
        screen: ResidentDashboardScreen(residentId: residentId, role: role),
      ),
      (
        title: 'Notifications',
        screen: NotificationsScreen(
          residentId: residentId ?? 'resident-id-placeholder',
        ),
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          role == 'admin'
              ? 'Admin Home'
              : role == 'chairman'
              ? 'Chairman Home'
              : role == 'owner'
              ? 'Owner Home'
              : 'Tenant Home',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const AuthScreen()),
                (_) => false,
              );
            },
            child: const Text('Logout'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    residentName == null ? 'You are logged in.' : 'Welcome, $residentName',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text('Use the options below to access the app features.'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          ...features.map(
            (feature) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: ListTile(
                  title: Text(feature.title),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => feature.screen),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
