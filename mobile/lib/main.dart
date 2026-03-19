import 'package:flutter/material.dart';
import 'login_screen.dart';
import 'dashboard_screen.dart';
import 'facility_booking_screen.dart';
import 'maintenance_requests_screen.dart';
import 'resident_dashboard_screen.dart';
import 'notifications_screen.dart';
import 'register_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Society MVP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/dashboard': (context) => const DashboardScreen(),
        '/facility-booking': (context) => const FacilityBookingScreen(),
        '/maintenance': (context) => const MaintenanceRequestsScreen(),
        '/resident-dashboard': (context) => const ResidentDashboardScreen(),
        '/notifications': (context) => NotificationsScreen(residentId: 'resident-id-placeholder'),
      },
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final actions = <({String title, String route})>[
      (title: 'Login', route: '/login'),
      (title: 'Sign Up', route: '/register'),
      (title: 'Announcements', route: '/dashboard'),
      (title: 'Facility Booking', route: '/facility-booking'),
      (title: 'Maintenance Requests', route: '/maintenance'),
      (title: 'Resident Dashboard', route: '/resident-dashboard'),
      (title: 'Notifications', route: '/notifications'),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Society MVP')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: actions.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final action = actions[index];
          return Card(
            child: ListTile(
              title: Text(action.title),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.pushNamed(context, action.route),
            ),
          );
        },
      ),
    );
  }
}
