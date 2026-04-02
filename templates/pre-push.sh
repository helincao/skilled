#!/bin/bash
# skilled-pre-push-hook
# Checks for un-upstreamed skill changes before push.
# Installed by: skilled hooks install

if command -v skilled &> /dev/null; then
  skilled check 2>/dev/null
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "⚠  Some skills have conflicts or un-upstreamed local changes."
    echo "   Run 'skilled check' for details, or 'skilled upstream <skill>' to create a PR."
    echo ""
  fi
elif command -v npx &> /dev/null; then
  npx --yes skilled check 2>/dev/null
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "⚠  Some skills have conflicts or un-upstreamed local changes."
    echo "   Run 'skilled check' for details."
    echo ""
  fi
fi
