# Session 0052 — BundleService.archive

Added `archive(shopId, id)`: sets `status = "archived"` without
soft-deleting. soft-delete already lives in M-049. 1 unit test.
