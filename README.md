Regrow architecture ->

CUT
→ pendingAction
→ FinishPendingActionsFeature
→ scheduleRespawn (nextSpawnAt)
→ WorldTickFeature
→ SpawnResourceFeature
→ HexObjectFactory.create()

todo:
oxlint