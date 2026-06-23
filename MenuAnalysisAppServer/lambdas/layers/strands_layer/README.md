# Strands Layer — Not Built Here

The strands-agents Lambda layer is referenced directly by its public ARN.
No local build is required.

## ARN format
```
arn:aws:lambda:{region}:856699698935:layer:strands-agents-py312-x86_64:{version}
```

## Finding the latest version
```bash
aws lambda get-layer-version \
  --layer-name arn:aws:lambda:us-east-1:856699698935:layer:strands-agents-py312-x86_64 \
  --version-number <N>
```

Update `STRANDS_LAYER_VERSION` in `MenuAnalysisAppCdk/lib/step-function-lambda-stack.js`
when a new version is released.

## Available architectures
- `strands-agents-py312-x86_64` — default Lambda architecture
- `strands-agents-py312-arm64` — use with Graviton Lambdas (set architecture: arm64 in CDK)
