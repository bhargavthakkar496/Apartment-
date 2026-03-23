import 'dart:async';
import 'dart:html' as html;

typedef CurrentLocation = ({double latitude, double longitude});

Future<CurrentLocation> getCurrentLocationImpl() async {
  final geolocation = html.window.navigator.geolocation;

  try {
    final position = await geolocation.getCurrentPosition();
    final latitude = (position.coords?.latitude ?? 0).toDouble();
    final longitude = (position.coords?.longitude ?? 0).toDouble();

    return (
      latitude: latitude,
      longitude: longitude,
    );
  } catch (error) {
    throw Exception('Unable to detect your location.');
  }
}
