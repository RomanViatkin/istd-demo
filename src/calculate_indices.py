from pathlib import Path
import pandas as pd

from load_data import load_all_data
from normalize import normalize_rowwise


BASE_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = BASE_DIR / "results"
RESULTS_DIR.mkdir(exist_ok=True)


def validate_inputs(data: dict[str, pd.DataFrame]) -> None:
    communities = data["communities"]
    factors = data["factors"]
    values = data["values"]
    block_weights = data["block_weights"]

    if communities["community_id"].duplicated().any():
        raise ValueError("Duplicate community_id found in communities.csv")

    if factors["factor_id"].duplicated().any():
        raise ValueError("Duplicate factor_id found in factors.csv")

    if block_weights["block_code"].duplicated().any():
        raise ValueError("Duplicate block_code found in block_weights.csv")

    weight_sum = block_weights["weight"].sum()
    if round(weight_sum, 6) != 1.0:
        raise ValueError(f"Block weights must sum to 1.0, got {weight_sum}")

    missing_factors = set(values["factor_id"]) - set(factors["factor_id"])
    if missing_factors:
        raise ValueError(f"Missing factors referenced in values: {missing_factors}")

    missing_communities = set(values["community_id"]) - set(communities["community_id"])
    if missing_communities:
        raise ValueError(f"Missing communities referenced in values: {missing_communities}")


def calculate_block_scores(normalized_df: pd.DataFrame) -> pd.DataFrame:
    normalized_df["weighted_factor_score"] = (
        normalized_df["normalized_value"] * normalized_df["weight_inside_block"]
    )

    block_scores = (
        normalized_df.groupby(["community_id", "block"], as_index=False)
        .agg(block_score=("weighted_factor_score", "sum"))
    )

    return block_scores


def pivot_block_scores(block_scores: pd.DataFrame) -> pd.DataFrame:
    pivot = block_scores.pivot(
        index="community_id",
        columns="block",
        values="block_score",
    ).reset_index()

    pivot.columns.name = None
    pivot = pivot.rename(
        columns={
            "spatial": "spatial_index",
            "development": "development_index",
            "security": "security_index",
        }
    )

    for col in ["spatial_index", "development_index", "security_index"]:
        if col not in pivot.columns:
            pivot[col] = 0.0

    return pivot


def calculate_total_index(scores_df: pd.DataFrame, block_weights_df: pd.DataFrame) -> pd.DataFrame:
    weights = dict(zip(block_weights_df["block_code"], block_weights_df["weight"]))

    scores_df["territorial_stability_index"] = (
        scores_df["spatial_index"] * weights.get("spatial", 0)
        + scores_df["development_index"] * weights.get("development", 0)
        + scores_df["security_index"] * weights.get("security", 0)
    )

    scores_df["stability_class"] = scores_df["territorial_stability_index"].apply(classify_stability)
    scores_df["rank"] = scores_df["territorial_stability_index"].rank(
        ascending=False, method="dense"
    ).astype(int)

    return scores_df.sort_values(["rank", "community_id"]).reset_index(drop=True)


def classify_stability(value: float) -> str:
    if value < 0.40:
        return "Critical"
    if value < 0.60:
        return "Vulnerable"
    if value < 0.80:
        return "Operational"
    return "High"


def merge_with_community_info(scores_df: pd.DataFrame, communities_df: pd.DataFrame) -> pd.DataFrame:
    return communities_df.merge(scores_df, on="community_id", how="left")


def export_outputs(final_df: pd.DataFrame, normalized_df: pd.DataFrame) -> None:
    final_df.to_csv(RESULTS_DIR / "community_scores.csv", index=False)
    final_df.to_json(RESULTS_DIR / "community_scores.json", orient="records", force_ascii=False, indent=2)
    normalized_df.to_csv(RESULTS_DIR / "normalized_factor_values.csv", index=False)

    ranking_df = final_df[[
        "rank",
        "community_name",
        "region",
        "spatial_index",
        "development_index",
        "security_index",
        "territorial_stability_index",
        "stability_class",
    ]].sort_values("rank")

    ranking_df.to_csv(RESULTS_DIR / "ranking.csv", index=False)


def main() -> None:
    data = load_all_data()
    validate_inputs(data)

    normalized_df = normalize_rowwise(data["values"], data["factors"])
    block_scores = calculate_block_scores(normalized_df)
    pivot_scores = pivot_block_scores(block_scores)
    final_scores = calculate_total_index(pivot_scores, data["block_weights"])
    final_df = merge_with_community_info(final_scores, data["communities"])

    export_outputs(final_df, normalized_df)

    print("\nCalculation completed successfully.")
    print(final_df[[
        "community_name",
        "spatial_index",
        "development_index",
        "security_index",
        "territorial_stability_index",
        "stability_class",
        "rank",
    ]])


if __name__ == "__main__":
    main()