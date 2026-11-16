//! Places as a gallery or story names them: the label a view shows for
//! one, and countries read as their ISO 3166 codes.

use serde_json::Value;

/// The label a view shows for `location` and `address`, as
/// `formatStoredLocation` writes it: the first part of the place's name,
/// then the locality, the region and the country's code, each left out
/// where it says again what came before it, the country where the name
/// is that country. A place with no address keeps its name whole.
pub fn display(location: &Value, address: &Value) -> String {
    let name = location["name"].as_str().unwrap_or_default().trim();
    let part = |key: &str| {
        address[key]
            .as_str()
            .map(str::trim)
            .filter(|v| !v.is_empty())
    };
    if ["locality", "region", "country"]
        .iter()
        .all(|k| address[*k].as_str().is_none_or(str::is_empty))
    {
        return name.to_string();
    }
    let primary = match name.split(',').next().unwrap_or_default().trim() {
        "" => name,
        first => first,
    };
    let country = country_code(address["country"].as_str().unwrap_or_default());
    let code = country.as_deref();
    let code = code.filter(|_| code != country_code(primary).as_deref());
    let mut parts: Vec<&str> = Vec::new();
    for v in [Some(primary), part("locality"), part("region"), code]
        .into_iter()
        .flatten()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        if parts
            .last()
            .is_none_or(|last| last.to_lowercase() != v.to_lowercase())
        {
            parts.push(v);
        }
    }
    parts.join(", ")
}

/// Spellings of a country neither its code nor its English name.
pub const ALIASES: &[(&str, &str)] = &[("USA", "US")];

/// The ISO 3166 code `raw` names, by its code, an alias or its English
/// name, in any case; what it says, in capitals, where it is none of
/// those; none where it is empty.
pub fn country_code(raw: &str) -> Option<String> {
    let s = raw.trim().to_uppercase();
    if s.is_empty() {
        return None;
    }
    let alias = ALIASES.iter().find(|(a, _)| *a == s).map(|(_, c)| *c);
    let named = REGIONS
        .iter()
        .find(|(_, n)| n.to_uppercase() == s)
        .map(|(c, _)| *c);
    Some(alias.or(named).map_or(s, str::to_string))
}

/// Each region's code and English name, as `Intl.DisplayNames(["en"])`
/// gives them, by code: where two codes share a name, the first is the
/// one the name reads as (GB, not UK).
pub const REGIONS: &[(&str, &str)] = &[
    ("AC", "Ascension Island"),
    ("AD", "Andorra"),
    ("AE", "United Arab Emirates"),
    ("AF", "Afghanistan"),
    ("AG", "Antigua & Barbuda"),
    ("AI", "Anguilla"),
    ("AL", "Albania"),
    ("AM", "Armenia"),
    ("AN", "Curaçao"),
    ("AO", "Angola"),
    ("AQ", "Antarctica"),
    ("AR", "Argentina"),
    ("AS", "American Samoa"),
    ("AT", "Austria"),
    ("AU", "Australia"),
    ("AW", "Aruba"),
    ("AX", "Åland Islands"),
    ("AZ", "Azerbaijan"),
    ("BA", "Bosnia & Herzegovina"),
    ("BB", "Barbados"),
    ("BD", "Bangladesh"),
    ("BE", "Belgium"),
    ("BF", "Burkina Faso"),
    ("BG", "Bulgaria"),
    ("BH", "Bahrain"),
    ("BI", "Burundi"),
    ("BJ", "Benin"),
    ("BL", "St. Barthélemy"),
    ("BM", "Bermuda"),
    ("BN", "Brunei"),
    ("BO", "Bolivia"),
    ("BQ", "Caribbean Netherlands"),
    ("BR", "Brazil"),
    ("BS", "Bahamas"),
    ("BT", "Bhutan"),
    ("BU", "Myanmar (Burma)"),
    ("BV", "Bouvet Island"),
    ("BW", "Botswana"),
    ("BY", "Belarus"),
    ("BZ", "Belize"),
    ("CA", "Canada"),
    ("CC", "Cocos (Keeling) Islands"),
    ("CD", "Congo - Kinshasa"),
    ("CF", "Central African Republic"),
    ("CG", "Congo - Brazzaville"),
    ("CH", "Switzerland"),
    ("CI", "Côte d’Ivoire"),
    ("CK", "Cook Islands"),
    ("CL", "Chile"),
    ("CM", "Cameroon"),
    ("CN", "China"),
    ("CO", "Colombia"),
    ("CP", "Clipperton Island"),
    ("CQ", "Sark"),
    ("CR", "Costa Rica"),
    ("CS", "Serbia"),
    ("CU", "Cuba"),
    ("CV", "Cape Verde"),
    ("CW", "Curaçao"),
    ("CX", "Christmas Island"),
    ("CY", "Cyprus"),
    ("CZ", "Czechia"),
    ("DD", "Germany"),
    ("DE", "Germany"),
    ("DG", "Diego Garcia"),
    ("DJ", "Djibouti"),
    ("DK", "Denmark"),
    ("DM", "Dominica"),
    ("DO", "Dominican Republic"),
    ("DY", "Benin"),
    ("DZ", "Algeria"),
    ("EA", "Ceuta & Melilla"),
    ("EC", "Ecuador"),
    ("EE", "Estonia"),
    ("EG", "Egypt"),
    ("EH", "Western Sahara"),
    ("ER", "Eritrea"),
    ("ES", "Spain"),
    ("ET", "Ethiopia"),
    ("EU", "European Union"),
    ("EZ", "Eurozone"),
    ("FI", "Finland"),
    ("FJ", "Fiji"),
    ("FK", "Falkland Islands"),
    ("FM", "Micronesia"),
    ("FO", "Faroe Islands"),
    ("FR", "France"),
    ("FX", "France"),
    ("GA", "Gabon"),
    ("GB", "United Kingdom"),
    ("GD", "Grenada"),
    ("GE", "Georgia"),
    ("GF", "French Guiana"),
    ("GG", "Guernsey"),
    ("GH", "Ghana"),
    ("GI", "Gibraltar"),
    ("GL", "Greenland"),
    ("GM", "Gambia"),
    ("GN", "Guinea"),
    ("GP", "Guadeloupe"),
    ("GQ", "Equatorial Guinea"),
    ("GR", "Greece"),
    ("GS", "South Georgia & South Sandwich Islands"),
    ("GT", "Guatemala"),
    ("GU", "Guam"),
    ("GW", "Guinea-Bissau"),
    ("GY", "Guyana"),
    ("HK", "Hong Kong SAR China"),
    ("HM", "Heard & McDonald Islands"),
    ("HN", "Honduras"),
    ("HR", "Croatia"),
    ("HT", "Haiti"),
    ("HU", "Hungary"),
    ("HV", "Burkina Faso"),
    ("IC", "Canary Islands"),
    ("ID", "Indonesia"),
    ("IE", "Ireland"),
    ("IL", "Israel"),
    ("IM", "Isle of Man"),
    ("IN", "India"),
    ("IO", "British Indian Ocean Territory"),
    ("IQ", "Iraq"),
    ("IR", "Iran"),
    ("IS", "Iceland"),
    ("IT", "Italy"),
    ("JE", "Jersey"),
    ("JM", "Jamaica"),
    ("JO", "Jordan"),
    ("JP", "Japan"),
    ("KE", "Kenya"),
    ("KG", "Kyrgyzstan"),
    ("KH", "Cambodia"),
    ("KI", "Kiribati"),
    ("KM", "Comoros"),
    ("KN", "St. Kitts & Nevis"),
    ("KP", "North Korea"),
    ("KR", "South Korea"),
    ("KW", "Kuwait"),
    ("KY", "Cayman Islands"),
    ("KZ", "Kazakhstan"),
    ("LA", "Laos"),
    ("LB", "Lebanon"),
    ("LC", "St. Lucia"),
    ("LI", "Liechtenstein"),
    ("LK", "Sri Lanka"),
    ("LR", "Liberia"),
    ("LS", "Lesotho"),
    ("LT", "Lithuania"),
    ("LU", "Luxembourg"),
    ("LV", "Latvia"),
    ("LY", "Libya"),
    ("MA", "Morocco"),
    ("MC", "Monaco"),
    ("MD", "Moldova"),
    ("ME", "Montenegro"),
    ("MF", "St. Martin"),
    ("MG", "Madagascar"),
    ("MH", "Marshall Islands"),
    ("MK", "North Macedonia"),
    ("ML", "Mali"),
    ("MM", "Myanmar (Burma)"),
    ("MN", "Mongolia"),
    ("MO", "Macao SAR China"),
    ("MP", "Northern Mariana Islands"),
    ("MQ", "Martinique"),
    ("MR", "Mauritania"),
    ("MS", "Montserrat"),
    ("MT", "Malta"),
    ("MU", "Mauritius"),
    ("MV", "Maldives"),
    ("MW", "Malawi"),
    ("MX", "Mexico"),
    ("MY", "Malaysia"),
    ("MZ", "Mozambique"),
    ("NA", "Namibia"),
    ("NC", "New Caledonia"),
    ("NE", "Niger"),
    ("NF", "Norfolk Island"),
    ("NG", "Nigeria"),
    ("NH", "Vanuatu"),
    ("NI", "Nicaragua"),
    ("NL", "Netherlands"),
    ("NO", "Norway"),
    ("NP", "Nepal"),
    ("NR", "Nauru"),
    ("NU", "Niue"),
    ("NZ", "New Zealand"),
    ("OM", "Oman"),
    ("PA", "Panama"),
    ("PE", "Peru"),
    ("PF", "French Polynesia"),
    ("PG", "Papua New Guinea"),
    ("PH", "Philippines"),
    ("PK", "Pakistan"),
    ("PL", "Poland"),
    ("PM", "St. Pierre & Miquelon"),
    ("PN", "Pitcairn Islands"),
    ("PR", "Puerto Rico"),
    ("PS", "Palestinian Territories"),
    ("PT", "Portugal"),
    ("PW", "Palau"),
    ("PY", "Paraguay"),
    ("QA", "Qatar"),
    ("QO", "Outlying Oceania"),
    ("RE", "Réunion"),
    ("RH", "Zimbabwe"),
    ("RO", "Romania"),
    ("RS", "Serbia"),
    ("RU", "Russia"),
    ("RW", "Rwanda"),
    ("SA", "Saudi Arabia"),
    ("SB", "Solomon Islands"),
    ("SC", "Seychelles"),
    ("SD", "Sudan"),
    ("SE", "Sweden"),
    ("SG", "Singapore"),
    ("SH", "St. Helena"),
    ("SI", "Slovenia"),
    ("SJ", "Svalbard & Jan Mayen"),
    ("SK", "Slovakia"),
    ("SL", "Sierra Leone"),
    ("SM", "San Marino"),
    ("SN", "Senegal"),
    ("SO", "Somalia"),
    ("SR", "Suriname"),
    ("SS", "South Sudan"),
    ("ST", "São Tomé & Príncipe"),
    ("SU", "Russia"),
    ("SV", "El Salvador"),
    ("SX", "Sint Maarten"),
    ("SY", "Syria"),
    ("SZ", "Eswatini"),
    ("TA", "Tristan da Cunha"),
    ("TC", "Turks & Caicos Islands"),
    ("TD", "Chad"),
    ("TF", "French Southern Territories"),
    ("TG", "Togo"),
    ("TH", "Thailand"),
    ("TJ", "Tajikistan"),
    ("TK", "Tokelau"),
    ("TL", "Timor-Leste"),
    ("TM", "Turkmenistan"),
    ("TN", "Tunisia"),
    ("TO", "Tonga"),
    ("TP", "Timor-Leste"),
    ("TR", "Türkiye"),
    ("TT", "Trinidad & Tobago"),
    ("TV", "Tuvalu"),
    ("TW", "Taiwan"),
    ("TZ", "Tanzania"),
    ("UA", "Ukraine"),
    ("UG", "Uganda"),
    ("UK", "United Kingdom"),
    ("UM", "U.S. Outlying Islands"),
    ("UN", "United Nations"),
    ("US", "United States"),
    ("UY", "Uruguay"),
    ("UZ", "Uzbekistan"),
    ("VA", "Vatican City"),
    ("VC", "St. Vincent & Grenadines"),
    ("VD", "Vietnam"),
    ("VE", "Venezuela"),
    ("VG", "British Virgin Islands"),
    ("VI", "U.S. Virgin Islands"),
    ("VN", "Vietnam"),
    ("VU", "Vanuatu"),
    ("WF", "Wallis & Futuna"),
    ("WS", "Samoa"),
    ("XA", "Pseudo-Accents"),
    ("XB", "Pseudo-Bidi"),
    ("XK", "Kosovo"),
    ("YD", "Yemen"),
    ("YE", "Yemen"),
    ("YT", "Mayotte"),
    ("YU", "Serbia"),
    ("ZA", "South Africa"),
    ("ZM", "Zambia"),
    ("ZR", "Congo - Kinshasa"),
    ("ZW", "Zimbabwe"),
    ("ZZ", "Unknown Region"),
];

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_place_reads_as_its_name_then_where_it_is() {
        let at = |name: &str, address: Value| display(&json!({ "name": name }), &address);
        let none = Value::Null;
        assert_eq!(
            at("Ocean Beach, San Francisco", none.clone()),
            "Ocean Beach, San Francisco"
        );
        assert_eq!(display(&none, &none), "");
        let sf = json!({"locality": "San Francisco", "region": "California", "country": "US"});
        assert_eq!(
            at("Blue Bottle Coffee", sf.clone()),
            "Blue Bottle Coffee, San Francisco, California, US"
        );
        assert_eq!(
            at("San Francisco, California, United States", sf),
            "San Francisco, California, US"
        );
        let ny = json!({"locality": "New York", "region": "new york", "country": "USA"});
        assert_eq!(at("New York, New York, United States", ny), "New York, US");
        assert_eq!(at("Greece", json!({"country": "GR"})), "Greece");
        assert_eq!(at("", json!({"locality": " ", "country": "gr"})), "GR");
        assert_eq!(
            at(", Athens", json!({"country": "Narnia"})),
            ", Athens, NARNIA"
        );
    }

    #[test]
    fn countries_read_as_their_codes() {
        assert_eq!(country_code(" usa ").as_deref(), Some("US"));
        assert_eq!(country_code("United Kingdom").as_deref(), Some("GB"));
        assert_eq!(country_code("de").as_deref(), Some("DE"));
        assert_eq!(country_code("  "), None);
    }
}
