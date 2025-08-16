import 'dart:io';

import 'package:grain/app_logger.dart';

/// Handles WebSocket connection, reconnection, and message listening.
class WebSocketService {
  final String wsUrl;
  final String? accessToken;
  final void Function(dynamic message) onMessage;
  WebSocket? _ws;
  bool _shouldReconnect = false;
  int _attempt = 0;
  static const int _maxRetries = 5;
  Duration _delay = const Duration(seconds: 2);

  WebSocketService({required this.wsUrl, required this.accessToken, required this.onMessage});

  Future<void> connect() async {
    _shouldReconnect = true;
    _attempt = 0;
    _delay = const Duration(seconds: 2);
    await _connectInternal();
  }

  Future<void> disconnect() async {
    _shouldReconnect = false;
    await _ws?.close();
    _ws = null;
  }

  Future<void> _connectInternal() async {
    if (accessToken == null) {
      appLogger.w('No access token for WebSocket connection');
      return;
    }
    final headers = {'Authorization': 'Bearer $accessToken', 'Content-Type': 'application/json'};
    try {
      appLogger.i('Connecting to WebSocket: $wsUrl (attempt ${_attempt + 1})');
      _ws = await WebSocket.connect(wsUrl, headers: headers);
      _ws!.listen(
        onMessage,
        onError: (error) async {
          appLogger.w('WebSocket error: $error');
          await _retry();
        },
        onDone: () async {
          appLogger.i('WebSocket connection closed');
          await _retry();
        },
      );
      appLogger.i('Connected to WebSocket: $wsUrl');
    } catch (e) {
      appLogger.e('Failed to connect to WebSocket: $e');
      await _retry();
    }
  }

  Future<void> _retry() async {
    if (!_shouldReconnect) return;
    if (_attempt < _maxRetries) {
      _attempt++;
      appLogger.i('Retrying WebSocket connection in ${_delay.inSeconds} seconds...');
      await Future.delayed(_delay);
      _delay *= 2;
      await _connectInternal();
    } else {
      appLogger.e('Max WebSocket retry attempts reached.');
    }
  }
}
