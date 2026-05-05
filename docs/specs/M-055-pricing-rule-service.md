# M-055 — PricingRule service

Operations on a bundle's pricing rules. Same shape as M-054
BundleItemService: tenant-safe add / update / remove. Routes can wire
this for fine-grained edits in the visual builder. The bundle service
already creates rules in bulk via M-049's `create`.
