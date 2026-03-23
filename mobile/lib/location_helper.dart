import 'location_helper_stub.dart'
    if (dart.library.html) 'location_helper_web.dart';

typedef CurrentLocation = ({double latitude, double longitude});

Future<CurrentLocation> getCurrentLocation() => getCurrentLocationImpl();
