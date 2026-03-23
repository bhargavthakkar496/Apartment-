import 'external_link_helper_stub.dart'
    if (dart.library.html) 'external_link_helper_web.dart';

Future<void> openExternalLink(String url) => openExternalLinkImpl(url);
