import pandas as pd


SCORE_LIKE_UNITS = {"score"}
INDEX_LIKE_UNITS = {"index", "percent"}


def normalize_rowwise(values_df: pd.DataFrame, factors_df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds normalized_value to community_factor_values.
    Logic:
    - score: assumed 0..10 -> divide by 10
    - index / percent: min-max normalization inside each factor_id
    """
    df = values_df.merge(
        factors_df[["factor_id", "unit", "factor_code", "block", "weight_inside_block"]],
        on="factor_id",
        how="left",
        validate="many_to_one",
    )

    if df["unit"].isna().any():
        missing = df[df["unit"].isna()]["factor_id"].unique()
        raise ValueError(f"Units missing for factor_id values: {missing}")

    df["normalized_value"] = 0.0

    # score factors: direct scaling
    score_mask = df["unit"].isin(SCORE_LIKE_UNITS)
    df.loc[score_mask, "normalized_value"] = df.loc[score_mask, "raw_value"] / 10.0

    # index/percent factors: min-max scaling per factor_id
    other_mask = df["unit"].isin(INDEX_LIKE_UNITS)
    for factor_id, group in df.loc[other_mask].groupby("factor_id"):
        min_v = group["raw_value"].min()
        max_v = group["raw_value"].max()

        if max_v == min_v:
            df.loc[group.index, "normalized_value"] = 1.0
        else:
            df.loc[group.index, "normalized_value"] = (
                (group["raw_value"] - min_v) / (max_v - min_v)
            )

    # clip for safety
    df["normalized_value"] = df["normalized_value"].clip(0, 1)

    return df