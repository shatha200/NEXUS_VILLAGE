# Trained model files

This folder intentionally does not contain `.joblib` files because the provided
Colab notebook contains training code, not the fitted model artifacts or its
required CSV datasets. Run the Colab training notebook with your real input
files; its last export cell creates `nexus24_outputs.zip`.

Install it with `python install_models.py /path/to/nexus24_outputs.zip`.
Only the rain classifier + conditional rain amount regressor are used directly
by `/predict-weather`. Other notebook regression models require historical site
features not present in the simplified five-token scenario API; they are NOT
silently substituted into NEXUS's optimizer.

Only load joblib artifacts from your own trusted training run.
