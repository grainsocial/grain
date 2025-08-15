import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/auth.dart';
import 'package:grain/main.dart';
import 'package:grain/models/notification.dart';
import 'package:grain/websocket_service.dart';

final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, AsyncValue<List<Notification>>>(
      (ref) => NotificationsNotifier(),
    );

class NotificationsNotifier extends StateNotifier<AsyncValue<List<Notification>>> {
  WebSocketService? _wsService;

  NotificationsNotifier() : super(const AsyncValue.loading()) {
    _connectAndListen();
  }

  void _connectAndListen() async {
    final session = await auth.getValidSession();
    final accessToken = session?.token;
    final wsUrl = AppConfig.wsUrl;
    if (accessToken == null) {
      state = AsyncValue.error('No access token', StackTrace.current);
      return;
    }
    _wsService = WebSocketService(
      wsUrl: wsUrl,
      accessToken: accessToken,
      onMessage: (message) async {
        try {
          final data = message is String ? jsonDecode(message) : message;
          if (data is Map<String, dynamic> && data['type'] == 'refresh-notifications') {
            final notifications = await apiService.getNotifications();
            if (mounted) state = AsyncValue.data(notifications);
          } else {
            final notification = Notification.fromJson(data);
            if (mounted) {
              final current = state.value ?? [];
              state = AsyncValue.data([...current, notification]);
            }
          }
        } catch (e) {
          // Handle parse error or ignore non-notification messages
        }
      },
    );
    try {
      final notifications = await apiService.getNotifications();
      if (mounted) state = AsyncValue.data(notifications);
    } catch (e, st) {
      if (mounted) state = AsyncValue.error(e, st);
    }
    await _wsService!.connect();
  }

  /// Fetch notifications directly from the API (without websocket)
  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final notifications = await apiService.getNotifications();
      if (mounted) {
        state = AsyncValue.data(notifications);
      }
    } catch (e, st) {
      if (mounted) state = AsyncValue.error(e, st);
    }
  }

  /// Marks all notifications as seen both on the server and locally.
  Future<void> updateSeen() async {
    final success = await apiService.updateSeen();
    if (success && mounted && state.value != null) {
      state = AsyncValue.data([for (final n in state.value!) n.copyWith(isRead: true)]);
    }
  }

  @override
  void dispose() {
    _wsService?.disconnect();
    super.dispose();
  }
}
