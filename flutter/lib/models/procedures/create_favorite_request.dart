import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_favorite_request.freezed.dart';
part 'create_favorite_request.g.dart';

/// Request model for creating a favorite.
/// See lexicon: social.grain.favorite.createFavorite
@freezed
class CreateFavoriteRequest with _$CreateFavoriteRequest {
  const factory CreateFavoriteRequest({required String subject}) = _CreateFavoriteRequest;

  factory CreateFavoriteRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateFavoriteRequestFromJson(json);
}
