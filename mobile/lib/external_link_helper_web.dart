import 'dart:html' as html;

Future<void> openExternalLinkImpl(String url) async {
  html.window.open(url, '_blank');
}
