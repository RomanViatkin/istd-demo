from pathlib import Path
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def load_csv(filename: str) -> pd.DataFrame:
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    return pd.read_csv(path)


def load_all_data() -> dict[str, pd.DataFrame]:
    return {
        "communities": load_csv("communities.csv"),
        "factors": load_csv("factors.csv"),
        "values": load_csv("community_factor_values.csv"),
        "block_weights": load_csv("block_weights.csv"),
    }


if __name__ == "__main__":
    data = load_all_data()
    for name, df in data.items():
        print(f"\n{name.upper()}")
        print(df.head())
        print(f"Rows: {len(df)}")