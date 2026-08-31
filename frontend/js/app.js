const nicknameInput = document.querySelector("#nickname");
const message = document.querySelector("#message");

function nickname() {
  const value = nicknameInput.value.trim();
  if (!value) {
    message.textContent = "닉네임을 입력해주세요.";
    nicknameInput.focus();
    return null;
  }
  return value;
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "how-to") {
      message.textContent = "← → 이동 · ↑ 회전 · ↓ 내리기 · Space 즉시 내리기";
      return;
    }
    const playerName = nickname();
    if (!playerName) return;
    const labels = {
      "quick-match": "상대방을 찾는 기능은 다음 단계에서 연결됩니다.",
      "create-room": "방 만들기 기능은 다음 단계에서 연결됩니다.",
      "join-room": "방 참가 기능은 다음 단계에서 연결됩니다.",
    };
    message.textContent = `${playerName}님, ${labels[action]}`;
  });
});

