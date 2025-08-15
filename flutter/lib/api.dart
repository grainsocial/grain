import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:grain/app_logger.dart';
import 'package:grain/main.dart';
import 'package:grain/models/session.dart';
import 'package:http/http.dart' as http;
import 'package:mime/mime.dart';

import './auth.dart';
import 'models/followers_result.dart';
import 'models/follows_result.dart';
import 'models/gallery.dart';
import 'models/gallery_photo.dart';
import 'models/gallery_thread.dart';
import 'models/notification.dart' as grain;
import 'models/procedures/procedures.dart';
import 'models/profile.dart';

class ApiService {
  Profile? currentUser;
  Profile? loadedProfile;
  List<Gallery> galleries = [];

  String get _apiUrl => AppConfig.apiUrl;

  Future<Session?> refreshSession(Session session) async {
    final url = Uri.parse('$_apiUrl/api/token/refresh');
    final headers = {'Content-Type': 'application/json'};
    try {
      final response = await http.post(
        url,
        headers: headers,
        body: jsonEncode({'refreshToken': session.refreshToken}),
      );
      if (response.statusCode == 200) {
        appLogger.i('Session refreshed successfully');
        return Session.fromJson(jsonDecode(response.body));
      } else {
        appLogger.w('Failed to refresh session: ${response.statusCode} ${response.body}');
        return null;
      }
    } catch (e) {
      appLogger.e('Error refreshing session: $e');
      return null;
    }
  }

  Future<bool> revokeSession(Session session) async {
    final url = Uri.parse('$_apiUrl/api/token/revoke');
    final headers = {'Content-Type': 'application/json'};
    try {
      final response = await http.post(
        url,
        headers: headers,
        body: jsonEncode({'refreshToken': session.refreshToken}),
      );
      if (response.statusCode == 200) {
        appLogger.i('Session revoked successfully');
        return true;
      } else {
        appLogger.w('Failed to revoke session: ${response.statusCode} ${response.body}');
        return false;
      }
    } catch (e) {
      appLogger.e('Error revoking session: $e');
      return false;
    }
  }

  Future<Profile?> fetchCurrentUser() async {
    final session = await auth.getValidSession();

    if (session == null || session.did.isEmpty) {
      return null;
    }

    final user = await fetchProfile(did: session.did);

    currentUser = user;

    return user;
  }

  Future<Profile?> fetchProfile({required String did}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    appLogger.i('Fetching profile for did: $did');
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.actor.getProfile?actor=$did'),
      headers: {'Content-Type': 'application/json', 'Authorization': "Bearer $token"},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch profile: ${response.statusCode} ${response.body}');
      return null;
    }
    return Profile.fromJson(jsonDecode(response.body));
  }

  Future<List<Gallery>> fetchActorGalleries({required String did}) async {
    appLogger.i('Fetching galleries for actor did: $did');
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.gallery.getActorGalleries?actor=$did'),
      headers: {'Content-Type': 'application/json'},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch galleries: ${response.statusCode} ${response.body}');
      return [];
    }
    final json = jsonDecode(response.body);
    galleries =
        (json['items'] as List<dynamic>?)?.map((item) => Gallery.fromJson(item)).toList() ?? [];
    return galleries;
  }

  Future<List<GalleryPhoto>> fetchActorPhotos({required String did}) async {
    appLogger.i('Fetching photos for actor did: $did');
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.photo.getActorPhotos?actor=$did'),
      headers: {'Content-Type': 'application/json'},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch photos: ${response.statusCode} ${response.body}');
      return [];
    }
    final json = jsonDecode(response.body);
    return (json['items'] as List<dynamic>?)?.map((item) => GalleryPhoto.fromJson(item)).toList() ??
        [];
  }

  Future<List<Gallery>> getTimeline({String? algorithm}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      return [];
    }
    appLogger.i('Fetching timeline with algorithm: ${algorithm ?? 'default'}');
    final uri = algorithm != null
        ? Uri.parse('$_apiUrl/xrpc/social.grain.feed.getTimeline?algorithm=$algorithm')
        : Uri.parse('$_apiUrl/xrpc/social.grain.feed.getTimeline');
    final response = await http.get(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch timeline: ${response.statusCode} ${response.body}');
      return [];
    }
    final json = jsonDecode(response.body);
    return (json['feed'] as List<dynamic>?)
            ?.map((item) => Gallery.fromJson(item as Map<String, dynamic>))
            .toList() ??
        [];
  }

  Future<Gallery?> getGallery({required String uri}) async {
    appLogger.i('Fetching gallery for uri: $uri');
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      appLogger.w('No access token for getGallery');
      return null;
    }
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.gallery.getGallery?uri=$uri'),
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch gallery: ${response.statusCode} ${response.body}');
      return null;
    }
    try {
      final json = jsonDecode(response.body);
      if (json is Map<String, dynamic>) {
        return Gallery.fromJson(json);
      } else {
        appLogger.w('Unexpected response type for getGallery: ${response.body}');
        return null;
      }
    } catch (e, st) {
      appLogger.e('Error parsing getGallery response: $e', stackTrace: st);
      return null;
    }
  }

  Future<GalleryThread?> getGalleryThread({required String uri}) async {
    appLogger.i('Fetching gallery thread for uri: $uri');
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      appLogger.w('No access token for getGalleryThread');
      return null;
    }
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.gallery.getGalleryThread?uri=$uri'),
      headers: {'Content-Type': 'application/json', 'Authorization': "Bearer $token"},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch gallery thread: ${response.statusCode} ${response.body}');
      return null;
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return GalleryThread.fromJson(json);
  }

  Future<List<grain.Notification>> getNotifications() async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      appLogger.w('No access token for getNotifications');
      return [];
    }
    appLogger.i('Fetching notifications');
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.notification.getNotifications'),
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch notifications: ${response.statusCode} ${response.body}');
      return [];
    }
    final json = jsonDecode(response.body);
    return (json['notifications'] as List<dynamic>?)
            ?.map((item) {
              final map = item as Map<String, dynamic>;
              final reasonSubject = map['reasonSubject'];
              if (reasonSubject != null && reasonSubject is Map<String, dynamic>) {
                final type =
                    reasonSubject['\$type'] ?? reasonSubject[r'$type'] ?? reasonSubject['type'];
                switch (type) {
                  case 'social.grain.gallery.defs#galleryView':
                    map['reasonSubjectGallery'] = map['reasonSubject'];
                    break;
                  case 'social.grain.actor.defs#profileView':
                    map['reasonSubjectProfile'] = map['reasonSubject'];
                    break;
                  case 'social.grain.comment.defs#commentView':
                    map['reasonSubjectComment'] = map['reasonSubject'];
                    break;
                }
              }
              map.remove('reasonSubject');
              try {
                return grain.Notification.fromJson(map);
              } catch (e, st) {
                appLogger.e('Failed to deserialize notification: $e', stackTrace: st);
                return null;
              }
            })
            .whereType<grain.Notification>()
            .toList() ??
        [];
  }

  Future<List<Profile>> searchActors(String query) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      appLogger.w('No access token for searchActors');
      return [];
    }
    appLogger.i('Searching actors with query: $query');
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.actor.searchActors?q=$query'),
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to search actors: ${response.statusCode} ${response.body}');
      return [];
    }
    final json = jsonDecode(response.body);
    return (json['actors'] as List<dynamic>?)?.map((item) => Profile.fromJson(item)).toList() ?? [];
  }

  Future<List<Gallery>> getActorFavs({required String did}) async {
    appLogger.i('Fetching actor favs for did: $did');
    final response = await http.get(
      Uri.parse('$_apiUrl/xrpc/social.grain.actor.getActorFavs?actor=$did'),
      headers: {'Content-Type': 'application/json'},
    );
    if (response.statusCode != 200) {
      appLogger.w('Failed to fetch actor favs: ${response.statusCode} ${response.body}');
      return [];
    }
    final json = jsonDecode(response.body);
    return (json['items'] as List<dynamic>?)?.map((item) => Gallery.fromJson(item)).toList() ?? [];
  }

  /// Fetch followers for a given actor DID
  Future<FollowersResult> getFollowers({
    required String actor,
    String? cursor,
    int limit = 50,
  }) async {
    final uri = Uri.parse(
      '$_apiUrl/xrpc/social.grain.graph.getFollowers?actor=$actor&limit=$limit${cursor != null ? '&cursor=$cursor' : ''}',
    );
    final response = await http.get(uri, headers: {'Content-Type': 'application/json'});
    if (response.statusCode != 200) {
      throw Exception('Failed to fetch followers: \\${response.statusCode} \\${response.body}');
    }
    final json = jsonDecode(response.body);
    return FollowersResult.fromJson(json);
  }

  /// Fetch follows for a given actor DID
  Future<FollowsResult> getFollows({required String actor, String? cursor, int limit = 50}) async {
    final uri = Uri.parse(
      '$_apiUrl/xrpc/social.grain.graph.getFollows?actor=$actor&limit=$limit${cursor != null ? '&cursor=$cursor' : ''}',
    );
    final response = await http.get(uri, headers: {'Content-Type': 'application/json'});
    if (response.statusCode != 200) {
      throw Exception('Failed to fetch follows: \\${response.statusCode} \\${response.body}');
    }
    final json = jsonDecode(response.body);
    return FollowsResult.fromJson(json);
  }

  // Procedures

  Future<UpdateProfileResponse> updateProfile({required UpdateProfileRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for updateProfile');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.actor.updateProfile');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to update profile: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return UpdateProfileResponse.fromJson(json);
  }

  Future<UpdateAvatarResponse> updateAvatar({required File avatarFile}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for updateAvatar');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.actor.updateAvatar');
    String? mimeType = lookupMimeType(avatarFile.path);
    final contentType = mimeType ?? 'application/octet-stream';
    final bytes = await avatarFile.readAsBytes();
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': contentType},
      body: bytes,
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to update avatar: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return UpdateAvatarResponse.fromJson(json);
  }

  Future<ApplySortResponse> applySort({required ApplySortRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for applySort');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.gallery.applySort');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to apply sort: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return ApplySortResponse.fromJson(json);
  }

  Future<ApplyAltsResponse> applyAlts({required ApplyAltsRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for applyAlts');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.photo.applyAlts');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to apply alts: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return ApplyAltsResponse.fromJson(json);
  }

  Future<CreateExifResponse> createExif({required CreateExifRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for createExif');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.photo.createExif');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create exif: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return CreateExifResponse.fromJson(json);
  }

  Future<CreateFollowResponse> createFollow({required CreateFollowRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for createFollow');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.graph.createFollow');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create follow: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return CreateFollowResponse.fromJson(json);
  }

  Future<DeleteFollowResponse> deleteFollow({required DeleteFollowRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for deleteFollow');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.graph.deleteFollow');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete follow: {response.statusCode} {response.body}');
    }
    final json = jsonDecode(response.body);
    return DeleteFollowResponse.fromJson(json);
  }

  Future<DeletePhotoResponse> deletePhoto({required DeletePhotoRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for deletePhoto');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.photo.deletePhoto');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete photo: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return DeletePhotoResponse.fromJson(json);
  }

  Future<UploadPhotoResponse> uploadPhoto(File file) async {
    final session = await auth.getValidSession();
    if (session == null) {
      appLogger.w('No valid session for uploadPhoto');
      throw Exception('No valid session for uploadPhoto');
    }
    final token = session.token;
    final uri = Uri.parse('${AppConfig.apiUrl}/xrpc/social.grain.photo.uploadPhoto');

    // Detect MIME type, fallback to application/octet-stream if unknown
    String? mimeType = lookupMimeType(file.path);
    final contentType = mimeType ?? 'application/octet-stream';

    appLogger.i('Uploading photo: ${file.path} (MIME: $mimeType)');
    final bytes = await file.readAsBytes();

    final response = await http.post(
      uri,
      headers: {'Authorization': 'Bearer $token', 'Content-Type': contentType},
      body: bytes,
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      appLogger.w(
        'Failed to upload photo: ${response.statusCode} ${response.body} (File: ${file.path}, MIME: $mimeType)',
      );
      throw Exception('Failed to upload photo: ${response.statusCode} ${response.body}');
    }

    try {
      final json = jsonDecode(response.body);
      appLogger.i('Uploaded photo result: $json');
      return UploadPhotoResponse.fromJson(json);
    } catch (e, st) {
      appLogger.e('Failed to parse createPhoto response: $e', stackTrace: st);
      throw Exception('Failed to parse createPhoto response: $e');
    }
  }

  Future<DeleteGalleryItemResponse> deleteGalleryItem({
    required DeleteGalleryItemRequest request,
  }) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for deleteGalleryItem');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.gallery.deleteItem');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete gallery item: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return DeleteGalleryItemResponse.fromJson(json);
  }

  Future<CreateGalleryItemResponse> createGalleryItem({
    required CreateGalleryItemRequest request,
  }) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for createGalleryItem');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.gallery.createItem');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create gallery item: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return CreateGalleryItemResponse.fromJson(json);
  }

  Future<UpdateGalleryResponse> updateGallery({required UpdateGalleryRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for updateGallery');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.gallery.updateGallery');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to update gallery: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return UpdateGalleryResponse.fromJson(json);
  }

  Future<DeleteGalleryResponse> deleteGallery({required DeleteGalleryRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for deleteGallery');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.gallery.deleteGallery');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete gallery: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return DeleteGalleryResponse.fromJson(json);
  }

  Future<CreateGalleryResponse> createGallery({required CreateGalleryRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for createGallery');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.gallery.createGallery');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create gallery: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return CreateGalleryResponse.fromJson(json);
  }

  Future<DeleteFavoriteResponse> deleteFavorite({required DeleteFavoriteRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for deleteFavorite');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.favorite.deleteFavorite');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete favorite: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return DeleteFavoriteResponse.fromJson(json);
  }

  Future<CreateFavoriteResponse> createFavorite({required CreateFavoriteRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for createFavorite');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.favorite.createFavorite');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create favorite: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return CreateFavoriteResponse.fromJson(json);
  }

  Future<DeleteCommentResponse> deleteComment({required DeleteCommentRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for deleteComment');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.comment.deleteComment');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete comment: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return DeleteCommentResponse.fromJson(json);
  }

  Future<CreateCommentResponse> createComment({required CreateCommentRequest request}) async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      throw Exception('No access token for createComment');
    }
    final uri = Uri.parse('$_apiUrl/xrpc/social.grain.comment.createComment');
    final response = await http.post(
      uri,
      headers: {'Authorization': "Bearer $token", 'Content-Type': 'application/json'},
      body: jsonEncode(request.toJson()),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create comment: ${response.statusCode} ${response.body}');
    }
    final json = jsonDecode(response.body);
    return CreateCommentResponse.fromJson(json);
  }

  Future<bool> updateSeen() async {
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      appLogger.w('No access token for updateSeen');
      return false;
    }
    final url = Uri.parse('$_apiUrl/xrpc/social.grain.notification.updateSeen');
    final seenAt = DateTime.now().toUtc().toIso8601String();
    final body = jsonEncode({'seenAt': seenAt});
    final headers = {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
    try {
      final response = await http.post(url, headers: headers, body: body);
      if (response.statusCode == 200) {
        appLogger.i('Successfully updated seen notifications at $seenAt');
        return true;
      } else {
        appLogger.w('Failed to update seen notifications: ${response.statusCode} ${response.body}');
        return false;
      }
    } catch (e) {
      appLogger.e('Error updating seen notifications: $e');
      return false;
    }
  }

  Future<Uint8List?> getGalleryCompositeImage({required String uri}) async {
    appLogger.i('Fetching gallery composite image for uri: $uri');
    final session = await auth.getValidSession();
    final token = session?.token;
    if (token == null) {
      appLogger.w('No access token for getGalleryCompositeImage');
      return null;
    }
    final url = '$_apiUrl/xrpc/social.grain.darkroom.getGalleryComposite?uri=$uri';
    final response = await http.get(Uri.parse(url), headers: {'Authorization': "Bearer $token"});
    if (response.statusCode != 200) {
      appLogger.w(
        'Failed to fetch gallery composite image: \\${response.statusCode} \\${response.body}',
      );
      return null;
    }
    try {
      return response.bodyBytes;
    } catch (e, st) {
      appLogger.e('Error parsing gallery composite image response: $e', stackTrace: st);
      return null;
    }
  }
}

final apiService = ApiService();
