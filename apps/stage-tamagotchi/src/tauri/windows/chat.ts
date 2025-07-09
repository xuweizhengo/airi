import { Webview } from '@tauri-apps/api/webview'
import { Window } from '@tauri-apps/api/window'

export async function newChatWindow() {
  const window = new Window('chat', {
    title: 'Chat',
    shadow: true,
    transparent: false,
    decorations: true,
    titleBarStyle: 'overlay',
    width: 600,
    height: 800, // wait for issue fixed: https://github.com/tauri-apps/tauri/issues/13790
  })

  window.once('tauri://window-created', () => {
    const _ = new Webview(window, 'chat', {
      x: 0,
      y: 0,
      width: 600,
      height: 800,
      url: '#/chat',
      acceptFirstMouse: true,
      transparent: false,
    })

    window.show()
  })
}
