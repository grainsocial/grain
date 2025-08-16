import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_favorite_request.freezed.dart';
part 'delete_favorite_request.g.dart';

/// Request model for deleting a favorite.
/// See lexicon: social.grain.favorite.deleteFavorite
@freezed
class DeleteFavoriteRequest with _$DeleteFavoriteRequest {
  const factory DeleteFavoriteRequest({required String uri}) = _DeleteFavoriteRequest;

  factory DeleteFavoriteRequest.fromJson(Map<String, dynamic> json) =>
      _$DeleteFavoriteRequestFromJson(json);
}
