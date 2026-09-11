/**
 * 远程通知页面组件（装配层）。
 *
 * 全部 state / effect / handler / 列定义已抽到 ./remote-notify/useRemoteNotifyLogic；
 * 本文件仅做「hook → RemoteNotifyView」的 props 装配。
 */

import RemoteNotifyView from './remote-notify/RemoteNotifyView';
import { useRemoteNotifyLogic } from './remote-notify/useRemoteNotifyLogic';

function RemoteNotify() {
  const {
    deps,
    draftAvailable,
    handleRestoreDraft,
    handleDiscardDraft,
    loadError,
    openHistory,
    mqttConnected,
    scheduled,
    scheduledPage,
    setScheduledPage,
    scheduledPerPage,
  } = useRemoteNotifyLogic();

  return (
    <RemoteNotifyView
      deps={deps}
      draftAvailable={draftAvailable}
      handleRestoreDraft={handleRestoreDraft}
      handleDiscardDraft={handleDiscardDraft}
      loadError={loadError}
      openHistory={openHistory}
      mqttConnected={mqttConnected}
      scheduled={scheduled}
      scheduledPage={scheduledPage}
      setScheduledPage={setScheduledPage}
      scheduledPerPage={scheduledPerPage}
    />
  );
}

export default RemoteNotify;
