use serde::{Serialize, Serializer};

/// A boolean that can only ever hold `V`.
///
/// The webview tells a command's outcomes apart by one boolean field
/// (`result.read`, `result.renamed`, ...), as the TypeScript discriminated
/// unions in `src/infrastructure/` expect. Each variant of an untagged result
/// enum carries this field with its own fixed value, so a variant cannot be
/// built with the discriminant that belongs to the other one.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Literal<const V: bool>;

impl<const V: bool> Serialize for Literal<V> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_bool(V)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialises_as_its_fixed_value() {
        assert_eq!(serde_json::to_string(&Literal::<true>).unwrap(), "true");
        assert_eq!(serde_json::to_string(&Literal::<false>).unwrap(), "false");
    }
}
