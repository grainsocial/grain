import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:grain/api.dart';
import 'package:grain/app_logger.dart';
import 'package:grain/main.dart';
import 'package:grain/models/session.dart';
import 'package:http/http.dart' as http;

class Auth {
  static const _storage = FlutterSecureStorage();
  static final _clientId = AppConfig.clientId;
  Auth();

  String _generateCodeVerifier() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (i) => random.nextInt(256));
    return base64UrlEncode(bytes).replaceAll('=', '');
  }

  String _generateCodeChallenge(String codeVerifier) {
    final bytes = utf8.encode(codeVerifier);
    final digest = sha256.convert(bytes);
    return base64UrlEncode(digest.bytes).replaceAll('=', '');
  }

  String _generateState() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (i) => random.nextInt(256));
    return base64UrlEncode(bytes).replaceAll('=', '');
  }

  Future<bool> hasToken() async {
    final session = await _loadSession();
    return session != null && session.token.isNotEmpty && !isSessionExpired(session);
  }

  Future<void> login(String handle) async {
    final aipUrl = AppConfig.aipUrl;

    final codeVerifier = _generateCodeVerifier();
    final codeChallenge = _generateCodeChallenge(codeVerifier);
    final state = _generateState();

    await _storage.write(key: 'code_verifier', value: codeVerifier);
    await _storage.write(key: 'state', value: state);

    appLogger.i('Starting OAuth flow with client ID: $_clientId');

    final authUrl = Uri.parse('$aipUrl/oauth/authorize').replace(
      queryParameters: {
        'response_type': 'code',
        'client_id': _clientId,
        'redirect_uri': 'grainflutter://oauth/callback',
        'scope': 'atproto:atproto',
        'state': state,
        'code_challenge': codeChallenge,
        'code_challenge_method': 'S256',
        'login_hint': handle,
      },
    );

    try {
      final redirectUrl = await FlutterWebAuth2.authenticate(
        url: authUrl.toString(),
        callbackUrlScheme: 'grainflutter',
      );

      appLogger.i('Redirected URL: $redirectUrl');

      final uri = Uri.parse(redirectUrl);
      final code = uri.queryParameters['code'];
      final returnedState = uri.queryParameters['state'];
      final error = uri.queryParameters['error'];

      if (error != null) {
        throw Exception('OAuth error: $error');
      }

      if (returnedState != state) {
        throw Exception('State mismatch in OAuth callback');
      }

      if (code == null || code.isEmpty) {
        throw Exception('No authorization code found in redirect URL');
      }

      await _exchangeCodeForTokens(code, codeVerifier);
    } catch (e) {
      await _storage.delete(key: 'code_verifier');
      await _storage.delete(key: 'state');
      appLogger.e('Error during authentication: $e');
      throw Exception('Authentication failed: $e');
    }
  }

  Future<void> _exchangeCodeForTokens(String code, String codeVerifier) async {
    final aipUrl = AppConfig.aipUrl;

    final tokenUrl = Uri.parse('$aipUrl/oauth/token');
    final headers = {'Content-Type': 'application/x-www-form-urlencoded'};
    final body = {
      'grant_type': 'authorization_code',
      'client_id': _clientId,
      'code': code,
      'redirect_uri': 'grainflutter://oauth/callback',
      'code_verifier': codeVerifier,
    };

    try {
      final response = await http.post(tokenUrl, headers: headers, body: body);

      if (response.statusCode != 200) {
        appLogger.w('Token exchange failed: ${response.statusCode} ${response.body}');
        throw Exception('Token exchange failed: ${response.statusCode}');
      }

      final tokenData = jsonDecode(response.body);
      final accessToken = tokenData['access_token'];
      final refreshToken = tokenData['refresh_token'];
      final expiresIn = tokenData['expires_in'] ?? 3600;

      if (accessToken == null || refreshToken == null) {
        throw Exception('Invalid token response: missing tokens');
      }

      final expiresAt = DateTime.now().add(Duration(seconds: expiresIn));

      final userInfoResponse = await http.get(
        Uri.parse('$aipUrl/oauth/userinfo'),
        headers: {'Authorization': 'Bearer $accessToken'},
      );

      if (userInfoResponse.statusCode != 200) {
        throw Exception('Failed to get session info: ${userInfoResponse.statusCode}');
      }

      final userInfoData = jsonDecode(userInfoResponse.body);
      final did = userInfoData['did'];

      if (did == null) {
        throw Exception('No DID found in userinfo response');
      }

      final session = Session(
        token: accessToken,
        refreshToken: refreshToken,
        expiresAt: expiresAt,
        did: did,
      );

      await _saveSession(session);
      await _storage.delete(key: 'code_verifier');
      await _storage.delete(key: 'state');

      appLogger.i('Successfully authenticated user with DID: $did');
    } catch (e) {
      await _storage.delete(key: 'code_verifier');
      await _storage.delete(key: 'state');
      appLogger.e('Error exchanging code for tokens: $e');
      rethrow;
    }
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
