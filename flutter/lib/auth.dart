import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:grain/api.dart';
import 'package:grain/app_logger.dart';
import 'package:grain/main.dart';
import 'package:grain/models/session.dart';

class Auth {
  static const _storage = FlutterSecureStorage();
  Auth();

  Future<bool> hasToken() async {
    final session = await _loadSession();
    return session != null && session.token.isNotEmpty && !isSessionExpired(session);
  }

  Future<void> login(String handle) async {
    final apiUrl = AppConfig.apiUrl;
    String? token;
    String? refreshToken;
    String? expiresAtStr;
    String? did;

    try {
      final redirectUrl = await FlutterWebAuth2.authenticate(
        url: '$apiUrl/oauth/login?client=native&handle=${Uri.encodeComponent(handle)}',
        callbackUrlScheme: 'grainflutter',
      );

      appLogger.i('Redirected URL: $redirectUrl');

      final uri = Uri.parse(redirectUrl);
      token = uri.queryParameters['token'];
      refreshToken = uri.queryParameters['refreshToken'];
      expiresAtStr = uri.queryParameters['expiresAt'];
      did = uri.queryParameters['did'];
    } catch (e) {
      appLogger.e('Error during authentication: $e');
      throw Exception('Authentication failed');
    }

    appLogger.i('User signed in with handle: $handle');

    if (token == null || token.isEmpty) {
      throw Exception('No token found in redirect URL');
    }
    if (refreshToken == null || refreshToken.isEmpty) {
      throw Exception('No refreshToken found in redirect URL');
    }
    if (expiresAtStr == null || expiresAtStr.isEmpty) {
      throw Exception('No expiresAt found in redirect URL');
    }
    if (did == null || did.isEmpty) {
      throw Exception('No did found in redirect URL');
    }

    DateTime expiresAt;
    try {
      expiresAt = DateTime.parse(expiresAtStr);
    } catch (e) {
      throw Exception('Invalid expiresAt format');
    }

    final session = Session(
      token: token,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
      did: did,
    );
    await _saveSession(session);
  }

  Future<void> _saveSession(Session session) async {
    final sessionJson = jsonEncode(session.toJson());
    await _storage.write(key: 'session', value: sessionJson);
  }

  Future<Session?> _loadSession() async {
    final sessionJsonString = await _storage.read(key: 'session');
    if (sessionJsonString == null) return null;

    try {
      final sessionJson = jsonDecode(sessionJsonString);
      return Session.fromJson(sessionJson);
    } catch (e) {
      // Optionally log or clear storage if corrupted
      return null;
    }
  }

  bool isSessionExpired(Session session, {Duration tolerance = const Duration(seconds: 30)}) {
    final now = DateTime.now().toUtc();
    return session.expiresAt.subtract(tolerance).isBefore(now);
  }

  Future<Session?> getValidSession() async {
    final session = await _loadSession();
    if (session == null) {
      // No session at all, do not attempt refresh
      return null;
    }
    if (isSessionExpired(session)) {
      appLogger.w('Session is expired, attempting refresh');
      try {
        final refreshed = await apiService.refreshSession(session);
        if (refreshed != null && !isSessionExpired(refreshed)) {
          await _saveSession(refreshed);
          appLogger.i('Session refreshed and saved');
          return refreshed;
        } else {
          appLogger.w('Session refresh failed or still expired, clearing session');
          await clearSession();
          return null;
        }
      } catch (e) {
        appLogger.e('Error refreshing session: $e');
        await clearSession();
        return null;
      }
    }
    return session;
  }

  Future<void> clearSession() async {
    // Remove session from secure storage
    await _storage.delete(key: 'session');
  }

  Future<void> logout() async {
    final session = await _loadSession();

    appLogger.i('Logging out user with session: $session');

    // Clear any in-memory session/user data
    apiService.currentUser = null;

    if (session == null) {
      appLogger.w('No session to revoke');
      return;
    }

    await apiService.revokeSession(session);

    await clearSession();

    appLogger.i('User logged out and session cleared');
  }
}

final auth = Auth();
