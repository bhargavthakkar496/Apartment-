import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'feature_hub_screen.dart';
import 'location_helper.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  static const int _pincodeLength = 6;
  static const List<({String value, String label})> _roles = [
    (value: 'resident', label: 'Tenant'),
    (value: 'owner', label: 'Owner'),
    (value: 'admin', label: 'Admin'),
    (value: 'chairman', label: 'Chairman'),
    (value: 'committee_member', label: 'Committee Member'),
    (value: 'housekeeping', label: 'Housekeeping'),
    (value: 'security', label: 'Security'),
    (value: 'plumber', label: 'Plumber'),
    (value: 'electrician', label: 'Electrician'),
    (value: 'vendor', label: 'Vendor'),
  ];

  static const Set<String> _rolesWithoutFlatNumber = {
    'admin',
    'chairman',
    'committee_member',
  };

  bool _isSubmitting = false;
  bool _isCheckingAccount = false;
  bool _isDetectingLocation = false;

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _pincodeController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  String _role = 'resident';
  bool _isLoadingSocieties = false;
  bool _isLoadingApartmentUnits = false;
  bool _hasCheckedAccount = false;
  bool? _accountExists;
  String? _selectedSocietyId;
  String? _selectedFlatNumber;
  String? _accountStatusMessage;
  String? _societyMatchMessage;
  String? _flatOccupancyMessage;
  List<Map<String, dynamic>> _societies = [];
  List<Map<String, dynamic>> _apartmentUnits = [];

  static final RegExp _passwordPolicy =
      RegExp(r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$');

  bool get _requiresFlatNumber => !_rolesWithoutFlatNumber.contains(_role);
  bool get _isOwnerRole => _role == 'owner';
  bool get _isReturningUser => _hasCheckedAccount && _accountExists == true;
  bool get _isNewUser => _hasCheckedAccount && _accountExists == false;
  String get _flatLegendPrimaryText => _isOwnerRole ? 'Black = available to list' : 'Black = available to occupy';
  String get _flatLegendSecondaryText =>
      _isOwnerRole ? 'Red = already listed by another owner' : 'Red = already occupied by another tenant';

  List<Map<String, dynamic>> get _uniqueApartmentUnits {
    final uniqueByFlatNumber = <String, Map<String, dynamic>>{};
    for (final apartmentUnit in _apartmentUnits) {
      final flatNumber = apartmentUnit['flatNumber']?.toString().trim() ?? '';
      if (flatNumber.isEmpty) continue;
      uniqueByFlatNumber.putIfAbsent(flatNumber, () => apartmentUnit);
    }
    return uniqueByFlatNumber.values.toList();
  }

  Set<String> get _selectableFlatValues {
    return _flatDropdownItems
        .map((item) => item.value)
        .whereType<String>()
        .toSet();
  }

  List<DropdownMenuItem<String>> get _flatDropdownItems {
    final seenValues = <String>{};
    final items = <DropdownMenuItem<String>>[];

    for (final apartmentUnit in _uniqueApartmentUnits) {
      final flatNumber = apartmentUnit['flatNumber']?.toString().trim() ?? '';
      if (flatNumber.isEmpty || seenValues.contains(flatNumber)) {
        continue;
      }
      seenValues.add(flatNumber);

      final occupied = apartmentUnit['occupied'] == true;
      final occupiedBy = apartmentUnit['occupiedBy']?.toString();
      final ownerListed = apartmentUnit['ownerListed'] == true;
      final ownerListedBy = apartmentUnit['ownerListedBy']?.toString();
      final isDisabled = _isOwnerRole ? ownerListed : occupied;
      final label = _isOwnerRole
          ? ownerListed && ownerListedBy != null
                ? 'Flat $flatNumber already listed by $ownerListedBy'
                : ownerListed
                ? 'Flat $flatNumber already listed'
                : 'Flat $flatNumber'
          : occupied && occupiedBy != null
          ? 'Flat $flatNumber occupied by $occupiedBy'
          : occupied
          ? 'Flat $flatNumber occupied'
          : 'Flat $flatNumber';

      items.add(
        DropdownMenuItem<String>(
          value: isDisabled ? null : flatNumber,
          enabled: !isDisabled,
          child: Text(
            label,
            style: TextStyle(
              color: isDisabled ? Colors.red : null,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      );
    }

    return items;
  }

  String? get _validatedSelectedFlatNumber {
    final selected = _selectedFlatNumber?.trim();
    if (selected == null) return null;
    return _selectableFlatValues.contains(selected) ? selected : null;
  }

  Map<String, dynamic>? get _selectedSociety {
    if (_selectedSocietyId == null) return null;

    for (final society in _societies) {
      if (society['id']?.toString() == _selectedSocietyId) {
        return society;
      }
    }

    return null;
  }

  String _toTitleCase(String value) {
    return value
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .map((part) {
          final lower = part.toLowerCase();
          return '${lower[0].toUpperCase()}${lower.substring(1)}';
        })
        .join(' ');
  }

  void _resetAccountFlow({bool clearPhone = false}) {
    setState(() {
      _hasCheckedAccount = false;
      _accountExists = null;
      _accountStatusMessage = null;
      _societyMatchMessage = null;
      _flatOccupancyMessage = null;
      _isLoadingSocieties = false;
      _isLoadingApartmentUnits = false;
      _selectedSocietyId = null;
      _selectedFlatNumber = null;
      _societies = [];
      _apartmentUnits = [];
      _nameController.clear();
      _emailController.clear();
      _passwordController.clear();
      _pincodeController.clear();
      _role = 'resident';
      if (clearPhone) {
        _phoneController.clear();
      }
    });
  }

  Future<void> _continueWithPhone() async {
    if (_isCheckingAccount) return;

    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your phone number first.')),
      );
      return;
    }

    setState(() {
      _isCheckingAccount = true;
      _accountStatusMessage = null;
      _societyMatchMessage = null;
      _flatOccupancyMessage = null;
    });

    try {
      final response = await http.post(
        ApiConfig.uri('/auth/account-status'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone': phone}),
      );
      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;

      if (!mounted) return;

      if (response.statusCode == 200 && body is Map<String, dynamic>) {
        final exists = body['exists'] == true;
        setState(() {
          _hasCheckedAccount = true;
          _accountExists = exists;
          _accountStatusMessage = body['message']?.toString();
          _passwordController.clear();
          if (exists) {
            _selectedSocietyId = null;
            _selectedFlatNumber = null;
            _societies = [];
            _apartmentUnits = [];
            _societyMatchMessage = null;
            _flatOccupancyMessage = null;
          }
        });

        if (!exists) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && _isNewUser) {
              _autoDetectLocationAndSocieties();
            }
          });
        }
        return;
      }

      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : 'Unable to continue right now.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isCheckingAccount = false;
        });
      }
    }
  }

  Future<void> _autoDetectLocationAndSocieties() async {
    if (_isDetectingLocation) return;

    setState(() {
      _isDetectingLocation = true;
      _societyMatchMessage = 'Detecting your location...';
    });

    try {
      final position = await getCurrentLocation();
      final detectedPincode = await _reverseGeocodePincode(
        latitude: position.latitude,
        longitude: position.longitude,
      );

      if (detectedPincode == null) {
        throw Exception('Could not determine your pincode from the current location.');
      }

      _pincodeController.text = detectedPincode;
      await _loadSocietiesForPincode(detectedPincode, isAutoDetected: true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _societyMatchMessage = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isDetectingLocation = false;
        });
      }
    }
  }

  Future<String?> _reverseGeocodePincode({
    required double latitude,
    required double longitude,
  }) async {
    final uri = Uri.https('nominatim.openstreetmap.org', '/reverse', {
      'format': 'jsonv2',
      'lat': latitude.toString(),
      'lon': longitude.toString(),
      'addressdetails': '1',
    });

    final response = await http.get(
      uri,
      headers: {
        'Accept': 'application/json',
      },
    );

    if (response.statusCode != 200) {
      return null;
    }

    final body = jsonDecode(response.body);
    if (body is! Map<String, dynamic>) {
      return null;
    }

    final address = body['address'];
    if (address is! Map<String, dynamic>) {
      return null;
    }

    final postcode = address['postcode']?.toString();
    if (postcode == null) {
      return null;
    }

    final digitsOnly = postcode.replaceAll(RegExp(r'[^0-9]'), '');
    if (digitsOnly.length < _pincodeLength) {
      return null;
    }

    return digitsOnly.substring(0, _pincodeLength);
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;
    if (!_hasCheckedAccount) {
      await _continueWithPhone();
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final response = _isReturningUser ? await _login() : await _register();
      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;

      if (!mounted) return;

      if (_isNewUser) {
        final message = body is Map<String, dynamic> && body['message'] != null
            ? body['message'].toString()
            : null;
        setState(() {
          _flatOccupancyMessage =
              message != null &&
                  message.toLowerCase().contains('already occupied')
              ? message
              : null;
        });
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = body as Map<String, dynamic>;
        final user = data['user'] as Map<String, dynamic>? ?? <String, dynamic>{};
        final resident = data['resident'] as Map<String, dynamic>?;
        final role = user['role']?.toString() ?? _role;
        final residentId = resident?['id']?.toString();

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isReturningUser ? 'Login successful.' : 'Account created successfully.',
            ),
          ),
        );

        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => FeatureHubScreen(
              role: role,
              residentId: residentId,
              residentName: resident?['name']?.toString(),
            ),
          ),
        );
        return;
      }

      final message = body is Map<String, dynamic> && body['message'] != null
          ? body['message'].toString()
          : (_isReturningUser ? 'Login failed. Please try again.' : 'Registration failed. Please try again.');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _openForgotPasswordDialog() async {
    final phoneController = TextEditingController(text: _phoneController.text);
    final otpController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    bool isRequestingOtp = false;
    bool isResettingPassword = false;
    String? statusMessage;
    String? debugOtp;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> requestOtp() async {
              final phone = phoneController.text.trim();
              if (phone.isEmpty) {
                setDialogState(() {
                  statusMessage = 'Enter your registered phone number first.';
                });
                return;
              }

              setDialogState(() {
                isRequestingOtp = true;
                statusMessage = null;
                debugOtp = null;
              });

              try {
                final response = await http.post(
                  ApiConfig.uri('/auth/forgot-password/request'),
                  headers: {'Content-Type': 'application/json'},
                  body: jsonEncode({'phone': phone}),
                );

                final body =
                    response.body.isNotEmpty ? jsonDecode(response.body) : null;

                setDialogState(() {
                  if (response.statusCode == 200 && body is Map<String, dynamic>) {
                    statusMessage =
                        body['message']?.toString() ??
                        'OTP sent to your registered email and mobile.';
                    debugOtp = body['debugOtp']?.toString();
                  } else {
                    statusMessage =
                        body is Map<String, dynamic> && body['message'] != null
                        ? body['message'].toString()
                        : 'Unable to send OTP right now.';
                  }
                });
              } finally {
                setDialogState(() {
                  isRequestingOtp = false;
                });
              }
            }

            Future<void> resetPassword() async {
              final phone = phoneController.text.trim();
              final otp = otpController.text.trim();
              final newPassword = newPasswordController.text;
              final confirmPassword = confirmPasswordController.text;

              if (phone.isEmpty || otp.isEmpty || newPassword.isEmpty) {
                setDialogState(() {
                  statusMessage =
                      'Phone, OTP, and new password are all required.';
                });
                return;
              }

              if (!_passwordPolicy.hasMatch(newPassword)) {
                setDialogState(() {
                  statusMessage =
                      'Password must be at least 6 characters and include letters, numbers, and special characters.';
                });
                return;
              }

              if (newPassword != confirmPassword) {
                setDialogState(() {
                  statusMessage = 'Password and confirm password do not match.';
                });
                return;
              }

              setDialogState(() {
                isResettingPassword = true;
                statusMessage = null;
              });

              try {
                final response = await http.post(
                  ApiConfig.uri('/auth/forgot-password/reset'),
                  headers: {'Content-Type': 'application/json'},
                  body: jsonEncode({
                    'phone': phone,
                    'otp': otp,
                    'newPassword': newPassword,
                  }),
                );

                final body =
                    response.body.isNotEmpty ? jsonDecode(response.body) : null;

                if (!mounted) return;

                if (response.statusCode == 200) {
                  _phoneController.text = phone;
                  _passwordController.clear();
                  if (dialogContext.mounted) {
                    Navigator.of(dialogContext).pop();
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        body is Map<String, dynamic> && body['message'] != null
                            ? body['message'].toString()
                            : 'Password reset successful.',
                      ),
                    ),
                  );
                  return;
                }

                setDialogState(() {
                  statusMessage =
                      body is Map<String, dynamic> && body['message'] != null
                      ? body['message'].toString()
                      : 'Unable to reset password right now.';
                });
              } finally {
                setDialogState(() {
                  isResettingPassword = false;
                });
              }
            }

            return AlertDialog(
              title: const Text('Reset Password'),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: 420,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: phoneController,
                        decoration: const InputDecoration(
                          labelText: 'Registered Phone',
                        ),
                        keyboardType: TextInputType.phone,
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: isRequestingOtp ? null : requestOtp,
                        child: Text(
                          isRequestingOtp ? 'Sending OTP...' : 'Send OTP',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: otpController,
                        decoration: const InputDecoration(labelText: 'OTP'),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: newPasswordController,
                        decoration: const InputDecoration(
                          labelText: 'New Password',
                        ),
                        obscureText: true,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: confirmPasswordController,
                        decoration: const InputDecoration(
                          labelText: 'Confirm Password',
                        ),
                        obscureText: true,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Password must be at least 6 characters and include letters, numbers, and special characters.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if (statusMessage != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          statusMessage!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      if (debugOtp != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Local test OTP: $debugOtp',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isRequestingOtp || isResettingPassword
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: isResettingPassword ? null : resetPassword,
                  child: Text(
                    isResettingPassword ? 'Resetting...' : 'Reset Password',
                  ),
                ),
              ],
            );
          },
        );
      },
    );

  }

  Future<http.Response> _login() {
    return http.post(
      ApiConfig.uri('/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phone': _phoneController.text.trim(),
        'password': _passwordController.text,
      }),
    );
  }

  Future<http.Response> _register() {
    return http.post(
      ApiConfig.uri('/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'phone': _phoneController.text.trim(),
        'societyId': _selectedSocietyId ?? '',
        'flatNo': _requiresFlatNumber ? (_selectedFlatNumber ?? '') : '',
        'password': _passwordController.text,
        'role': _role,
      }),
    );
  }

  Future<void> _lookupSocietiesByPincode() async {
    final pincode = _pincodeController.text.trim();

    if (pincode.length != _pincodeLength) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid 6-digit pincode first.')),
      );
      return;
    }

    await _loadSocietiesForPincode(pincode, isAutoDetected: false);
  }

  Future<void> _loadSocietiesForPincode(
    String pincode, {
    required bool isAutoDetected,
  }) async {
    setState(() {
      _isLoadingSocieties = true;
      _selectedSocietyId = null;
      _selectedFlatNumber = null;
      _societies = [];
      _apartmentUnits = [];
      _societyMatchMessage = isAutoDetected
          ? 'Looking up societies near your current location...'
          : 'Looking up societies for pincode $pincode...';
      _flatOccupancyMessage = null;
    });

    try {
      final response = await http.get(
        ApiConfig.uri('/societies/discover?pincode=$pincode'),
      );
      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;

      if (!mounted) return;

      if (response.statusCode == 200 && body is Map<String, dynamic>) {
        final items = (body['items'] as List<dynamic>? ?? [])
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();

        setState(() {
          _societies = items;
          _selectedSocietyId = items.isNotEmpty ? items.first['id']?.toString() : null;
          _societyMatchMessage = _buildSocietyMatchMessage(body);
        });

        if (_selectedSocietyId != null && _requiresFlatNumber) {
          await _loadApartmentUnitsForSelectedSociety();
        }

        if (items.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No societies found for this pincode.')),
          );
        }
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to load societies for this pincode.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingSocieties = false;
        });
      }
    }
  }

  Future<void> _loadApartmentUnitsForSelectedSociety() async {
    if (_selectedSocietyId == null || !_requiresFlatNumber) {
      setState(() {
        _apartmentUnits = [];
        _selectedFlatNumber = null;
      });
      return;
    }

    setState(() {
      _isLoadingApartmentUnits = true;
      _apartmentUnits = [];
      _selectedFlatNumber = null;
      _flatOccupancyMessage = null;
    });

    try {
      final response = await http.get(
        ApiConfig.uri('/societies/${_selectedSocietyId!}/apartments'),
      );
      final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;

      if (!mounted) return;

      if (response.statusCode == 200 && body is List) {
        final apartmentUnits = body
            .map((item) => Map<String, dynamic>.from(item as Map))
            .where((item) => (item['flatNumber']?.toString().trim() ?? '').isNotEmpty)
            .toList();
        final uniqueByFlatNumber = <String, Map<String, dynamic>>{};
        for (final apartmentUnit in apartmentUnits) {
          final flatNumber = apartmentUnit['flatNumber']?.toString().trim() ?? '';
          if (flatNumber.isEmpty) continue;
          uniqueByFlatNumber.putIfAbsent(flatNumber, () => apartmentUnit);
        }
        final dedupedApartmentUnits = uniqueByFlatNumber.values.toList();

        setState(() {
          _apartmentUnits = dedupedApartmentUnits;
          final firstAvailable = dedupedApartmentUnits.cast<Map<String, dynamic>>().firstWhere(
            (item) => item['occupied'] != true,
            orElse: () => <String, dynamic>{},
          );
          _selectedFlatNumber = firstAvailable['flatNumber']?.toString().trim();
        });
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to load apartment units.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingApartmentUnits = false;
        });
      }
    }
  }

  String _buildSocietyMatchMessage(Map<String, dynamic> body) {
    final requestedPincode = body['requestedPincode']?.toString() ?? '';
    final matchedPincode = body['matchedPincode']?.toString() ?? '';
    final matchType = body['matchType']?.toString() ?? 'none';

    if (matchType == 'exact') {
      return 'Showing societies for detected pincode $requestedPincode.';
    }

    if (matchType == 'nearby') {
      return 'No exact societies for $requestedPincode. Showing nearby societies from $matchedPincode.';
    }

    return 'No societies were found for the detected location.';
  }

  @override
  Widget build(BuildContext context) {
    final title = !_hasCheckedAccount
        ? 'Welcome to Society MVP'
        : _isReturningUser
        ? 'Welcome Back'
        : 'Finish Creating Your Account';
    final subtitle = !_hasCheckedAccount
        ? 'Enter your registered mobile number to continue.'
        : _isReturningUser
        ? 'We found your account. Enter your password to sign in.'
        : 'No account was found. Fill in the remaining details to create one and continue.';
    final buttonLabel = !_hasCheckedAccount
        ? (_isCheckingAccount ? 'Checking account...' : 'Continue')
        : _isSubmitting
        ? (_isReturningUser ? 'Signing in...' : 'Creating account...')
        : (_isReturningUser ? 'Login' : 'Create Account');
    final selectedSociety = _selectedSociety;

    return Scaffold(
      appBar: AppBar(title: const Text('Society MVP')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    Text(subtitle),
                    if (_accountStatusMessage != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _accountStatusMessage!,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                    const SizedBox(height: 24),
                    TextField(
                      controller: _phoneController,
                      readOnly: _hasCheckedAccount,
                      decoration: InputDecoration(
                        labelText: 'Phone',
                        suffixIcon: _hasCheckedAccount
                            ? IconButton(
                                onPressed: _isSubmitting || _isCheckingAccount
                                    ? null
                                    : _resetAccountFlow,
                                icon: const Icon(Icons.edit_outlined),
                                tooltip: 'Change phone number',
                              )
                            : null,
                      ),
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 12),
                    if (_isNewUser) ...[
                      TextField(
                        controller: _nameController,
                        decoration: const InputDecoration(labelText: 'Name'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _emailController,
                        decoration: const InputDecoration(labelText: 'Email'),
                        keyboardType: TextInputType.emailAddress,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _role,
                        isExpanded: true,
                        decoration: const InputDecoration(labelText: 'Role'),
                        items: _roles
                            .map(
                              (role) => DropdownMenuItem(
                                value: role.value,
                                child: Text(role.label),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value == null) return;
                          setState(() {
                            _role = value;
                            if (!_requiresFlatNumber) {
                              _selectedFlatNumber = null;
                              _apartmentUnits = [];
                            }
                            _flatOccupancyMessage = null;
                          });
                          if (_requiresFlatNumber) {
                            _loadApartmentUnitsForSelectedSociety();
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pincodeController,
                        decoration: InputDecoration(
                          labelText: 'Pincode',
                          suffixIconConstraints: const BoxConstraints(
                            minWidth: 64,
                            minHeight: 40,
                          ),
                          suffixIcon: TextButton(
                            onPressed: _isLoadingSocieties ? null : _lookupSocietiesByPincode,
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              minimumSize: const Size(56, 36),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(_isLoadingSocieties ? '...' : 'Find'),
                          ),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: _isDetectingLocation ? null : _autoDetectLocationAndSocieties,
                          icon: const Icon(Icons.my_location),
                          label: Text(
                            _isDetectingLocation ? 'Detecting location...' : 'Use my current location',
                          ),
                        ),
                      ),
                      if (_societyMatchMessage != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          _societyMatchMessage!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      const SizedBox(height: 12),
                      if (_societies.isNotEmpty) ...[
                        DropdownButtonFormField<String>(
                          initialValue: _selectedSocietyId,
                          isExpanded: true,
                          decoration: const InputDecoration(labelText: 'Society'),
                          items: _societies
                              .map(
                                (society) => DropdownMenuItem(
                                  value: society['id']?.toString(),
                                  child: Text(
                                    '${society['name']} (${society['area']}, ${society['city']}, ${society['state']})',
                                    overflow: TextOverflow.ellipsis,
                                    maxLines: 1,
                                  ),
                                ),
                              )
                              .toList(),
                          selectedItemBuilder: (context) {
                            return _societies
                                .map(
                                  (society) => Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      society['name']?.toString() ?? '',
                                      overflow: TextOverflow.ellipsis,
                                      maxLines: 1,
                                    ),
                                  ),
                                )
                                .toList();
                          },
                          onChanged: (value) {
                            setState(() {
                              _selectedSocietyId = value;
                              _flatOccupancyMessage = null;
                            });
                            _loadApartmentUnitsForSelectedSociety();
                          },
                        ),
                        const SizedBox(height: 12),
                        if (selectedSociety != null) ...[
                          _ReadOnlyLocationField(
                            label: 'Area',
                            value: _toTitleCase(
                              selectedSociety['area']?.toString() ?? '',
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ],
                    ],
                    if (_isNewUser && _requiresFlatNumber) ...[
                      DropdownButtonFormField<String>(
                        key: ValueKey('${_selectedSocietyId ?? 'none'}-$_role-${_validatedSelectedFlatNumber ?? 'none'}-${_flatDropdownItems.length}'),
                        initialValue: _validatedSelectedFlatNumber,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: 'Flat Number',
                          helperText: _selectedSocietyId == null
                              ? 'Select a society first'
                              : _isLoadingApartmentUnits
                                  ? 'Loading apartment units...'
                                  : _isOwnerRole
                                      ? 'Choose a flat that is not already listed by another owner'
                                      : 'Choose one of the valid apartment units',
                          errorText: _flatOccupancyMessage,
                        ),
                        items: _flatDropdownItems,
                        onChanged: (_selectedSocietyId == null || _isLoadingApartmentUnits)
                            ? null
                            : (value) {
                                setState(() {
                                  _selectedFlatNumber = value;
                                  _flatOccupancyMessage = null;
                                });
                              },
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 12,
                        runSpacing: 6,
                        children: [
                          _LegendHint(
                            color: Colors.black87,
                            text: _flatLegendPrimaryText,
                          ),
                          _LegendHint(
                            color: Colors.red,
                            text: _flatLegendSecondaryText,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_hasCheckedAccount) ...[
                      TextField(
                        controller: _passwordController,
                        decoration: InputDecoration(
                          labelText: _isReturningUser
                              ? 'Password'
                              : 'Create Password',
                        ),
                        obscureText: true,
                      ),
                      const SizedBox(height: 12),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _isSubmitting || _isCheckingAccount ? null : _submit,
                      child: Text(buttonLabel),
                    ),
                    const SizedBox(height: 12),
                    if (_isReturningUser) ...[
                      TextButton(
                        onPressed: _isSubmitting ? null : _openForgotPasswordDialog,
                        child: const Text('Forgot password?'),
                      ),
                    ],
                    if (_hasCheckedAccount)
                      TextButton(
                        onPressed: _isSubmitting || _isCheckingAccount
                            ? null
                            : _resetAccountFlow,
                        child: const Text('Use a different phone number'),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _pincodeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}

class _ReadOnlyLocationField extends StatelessWidget {
  const _ReadOnlyLocationField({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: value,
      readOnly: true,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
      ),
    );
  }
}

class _LegendHint extends StatelessWidget {
  const _LegendHint({
    required this.color,
    required this.text,
  });

  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
