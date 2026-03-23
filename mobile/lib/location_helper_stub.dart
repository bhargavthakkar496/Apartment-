typedef CurrentLocation = ({double latitude, double longitude});

Future<CurrentLocation> getCurrentLocationImpl() {
  throw UnsupportedError(
    'Automatic location detection is currently supported in the web build only.',
  );
}
