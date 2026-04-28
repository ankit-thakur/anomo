# Building the Strands Layer

Before deploying, build this layer locally using Docker (matches Lambda runtime):

```bash
cd MenuAnalysisAppServer/lambdas/layers/strands_layer

# Build for Lambda Python 3.12 runtime (arm64 or x86_64 depending on your Lambda arch)
docker run --rm \
  -v "$(pwd):/var/task" \
  public.ecr.aws/sam/build-python3.12:latest \
  pip install -r requirements.txt -t python/lib/python3.12/site-packages/

# Verify the install
ls python/lib/python3.12/site-packages/ | grep strands
```

The resulting `python/` directory is what CDK zips up into the Lambda layer.

## Checking strands-agents package size

```bash
du -sh python/
```

If the unzipped size approaches 100MB, consider trimming with:
```
pip install strands-agents --no-deps  # then add deps manually
```

Lambda layer limit: 250MB unzipped across all layers combined.
