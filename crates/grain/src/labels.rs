//! The labels grain's labeler gives out, what a report asks for, and which
//! of them are about the safety of children.
//!
//! A report names its reason as atproto does
//! (`com.atproto.moderation.createReport`'s `reasonType`), and grain files
//! it under the label it asks for ([`label_for`]): resolving the report
//! applies that label. Child safety (`csae`) is set apart
//! ([`child_safety`]): what a report or label of it is about is for a
//! person to judge, and is never handed to a model.

use serde_json::{Value, json};

/// The label of child sexual abuse and exploitation.
pub const CSAE: &str = "csae";

/// A label grain's labeler gives out, as
/// `com.atproto.label.defs#labelValueDefinition` has one, in English.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Definition {
    pub identifier: &'static str,
    /// `inform`, `alert` or `none`.
    pub severity: &'static str,
    /// `content`, `media` or `none`.
    pub blurs: &'static str,
    /// `ignore`, `warn` or `hide`.
    pub default_setting: &'static str,
    pub name: &'static str,
    pub description: &'static str,
}

/// Every label grain's labeler gives out, as its report sheet lists them.
pub const DEFINITIONS: &[Definition] = &[
    Definition {
        identifier: "copyright",
        severity: "alert",
        blurs: "content",
        default_setting: "hide",
        name: "Copyright Violation",
        description: "Content that infringes on copyright or intellectual property.",
    },
    Definition {
        identifier: CSAE,
        severity: "alert",
        blurs: "content",
        default_setting: "hide",
        name: "Child Safety",
        description: "Sexual content involving a minor, or the exploitation, grooming or endangerment of a child.",
    },
    Definition {
        identifier: "gore",
        severity: "alert",
        blurs: "media",
        default_setting: "hide",
        name: "Graphic Media",
        description: "Graphic or violent imagery.",
    },
    Definition {
        identifier: "harassment",
        severity: "alert",
        blurs: "none",
        default_setting: "warn",
        name: "Harassment",
        description: "Targeted harassment, bullying, or hate speech.",
    },
    Definition {
        identifier: "misleading",
        severity: "inform",
        blurs: "none",
        default_setting: "warn",
        name: "Misleading",
        description: "Impersonation, misinformation, or deceptive content.",
    },
    Definition {
        identifier: "nudity",
        severity: "inform",
        blurs: "media",
        default_setting: "warn",
        name: "Nudity",
        description: "Content containing nudity.",
    },
    Definition {
        identifier: "other",
        severity: "none",
        blurs: "none",
        default_setting: "ignore",
        name: "Other",
        description: "Content that does not fit other report categories.",
    },
    Definition {
        identifier: "sexual",
        severity: "inform",
        blurs: "media",
        default_setting: "warn",
        name: "Sexual Content",
        description: "Unwanted or mislabeled sexual content.",
    },
    Definition {
        identifier: "spam",
        severity: "inform",
        blurs: "content",
        default_setting: "hide",
        name: "Spam",
        description: "Unwanted or repetitive promotional content.",
    },
];

impl Definition {
    /// As `com.atproto.label.defs#labelValueDefinition`.
    pub fn json(&self) -> Value {
        json!({
            "identifier": self.identifier,
            "severity": self.severity,
            "blurs": self.blurs,
            "defaultSetting": self.default_setting,
            "locales": [{"lang": "en", "name": self.name, "description": self.description}],
        })
    }
}

/// atproto's reason types (`com.atproto.moderation.defs#reason…`).
const ATPROTO: &str = "com.atproto.moderation.defs#reason";
/// Ozone's finer ones (`tools.ozone.report.defs#reason…`).
const OZONE: &str = "tools.ozone.report.defs#reason";
/// grain's own, for the labels neither has a reason for.
const GRAIN: &str = "social.grain.moderation.defs#reason";

/// The label a report for `reason_type` asks for, if grain takes the
/// reason: each of atproto's and Ozone's, and grain's own
/// `social.grain.moderation.defs#reasonCopyright` and `#reasonNudity`.
pub fn label_for(reason_type: &str) -> Option<&'static str> {
    if let Some(reason) = reason_type.strip_prefix(ATPROTO) {
        return Some(match reason {
            "Spam" => "spam",
            "Misleading" => "misleading",
            "Sexual" => "sexual",
            "Rude" => "harassment",
            "Violation" | "Other" | "Appeal" => "other",
            _ => return None,
        });
    }
    if let Some(reason) = reason_type.strip_prefix(OZONE) {
        let label = match reason {
            "MisleadingSpam" => "spam",
            "ViolenceGraphicContent" => "gore",
            r if r.starts_with("ChildSafety") => CSAE,
            r if r.starts_with("Misleading") => "misleading",
            r if r.starts_with("Sexual") => "sexual",
            r if r.starts_with("Harassment") => "harassment",
            r if ["Appeal", "Other", "Violence", "Rule", "SelfHarm"]
                .iter()
                .any(|kind| r.starts_with(kind)) =>
            {
                "other"
            }
            _ => return None,
        };
        return Some(label);
    }
    match reason_type.strip_prefix(GRAIN)? {
        "Copyright" => Some("copyright"),
        "Nudity" => Some("nudity"),
        _ => None,
    }
}

/// Whether a report or label of `label`, or made for the reason type
/// `reason`, is about the safety of children.
pub fn child_safety(label: &str, reason: Option<&str>) -> bool {
    label == CSAE || reason.and_then(label_for) == Some(CSAE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_reason_is_filed_under_a_label() {
        let cases = [
            ("com.atproto.moderation.defs#reasonSpam", "spam"),
            ("com.atproto.moderation.defs#reasonMisleading", "misleading"),
            ("com.atproto.moderation.defs#reasonSexual", "sexual"),
            ("com.atproto.moderation.defs#reasonRude", "harassment"),
            ("com.atproto.moderation.defs#reasonViolation", "other"),
            ("com.atproto.moderation.defs#reasonOther", "other"),
            ("com.atproto.moderation.defs#reasonAppeal", "other"),
            ("tools.ozone.report.defs#reasonMisleadingSpam", "spam"),
            (
                "tools.ozone.report.defs#reasonViolenceGraphicContent",
                "gore",
            ),
            ("tools.ozone.report.defs#reasonChildSafetyCSAM", CSAE),
            ("tools.ozone.report.defs#reasonChildSafetyGroom", CSAE),
            ("tools.ozone.report.defs#reasonMisleadingScam", "misleading"),
            ("tools.ozone.report.defs#reasonSexualNCII", "sexual"),
            (
                "tools.ozone.report.defs#reasonHarassmentDoxxing",
                "harassment",
            ),
            ("tools.ozone.report.defs#reasonViolenceThreats", "other"),
            ("tools.ozone.report.defs#reasonRuleBanEvasion", "other"),
            ("tools.ozone.report.defs#reasonSelfHarmED", "other"),
            ("tools.ozone.report.defs#reasonAppeal", "other"),
            ("social.grain.moderation.defs#reasonCopyright", "copyright"),
            ("social.grain.moderation.defs#reasonNudity", "nudity"),
        ];
        for (reason, label) in cases {
            assert_eq!(label_for(reason), Some(label), "{reason}");
            assert!(DEFINITIONS.iter().any(|d| d.identifier == label));
        }
        for unknown in [
            "com.atproto.moderation.defs#reasonBoring",
            "tools.ozone.report.defs#reasonBoring",
            "social.grain.moderation.defs#reasonBoring",
            "spam",
            "",
        ] {
            assert_eq!(label_for(unknown), None, "{unknown}");
        }
    }

    #[test]
    fn child_safety_is_known_by_its_label_or_its_reason() {
        assert!(child_safety(CSAE, None));
        assert!(child_safety(
            "other",
            Some("tools.ozone.report.defs#reasonChildSafetyOther")
        ));
        assert!(!child_safety("spam", None));
        assert!(!child_safety(
            "spam",
            Some("com.atproto.moderation.defs#reasonSpam")
        ));
    }

    #[test]
    fn definitions_read_as_atprotos() {
        let csae = DEFINITIONS.iter().find(|d| d.identifier == CSAE).unwrap();
        let json = csae.json();
        assert_eq!(json["defaultSetting"], "hide");
        assert_eq!(json["locales"][0]["name"], "Child Safety");
        let mut ids: Vec<_> = DEFINITIONS.iter().map(|d| d.identifier).collect();
        ids.dedup();
        assert_eq!(ids.len(), DEFINITIONS.len());
    }
}
