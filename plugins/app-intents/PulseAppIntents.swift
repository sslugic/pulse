import AppIntents
import Foundation

// Siri, Shortcuts, the Action Button and Back Tap: "Hey Siri, log with Pulse" asks what to log and
// sends it to the Coach; "Talk to Pulse" opens the Coach already recording. The request is left in
// UserDefaults for the PulseIntents module, which hands it to the app once its JS is running.
// Added to the app target by plugins/with-app-intents.js (App Intents must live in the app itself).

@available(iOS 16.0, *)
enum PulseLink {
  static func send(_ query: [URLQueryItem]) {
    var url = URLComponents(string: "pulse://coach")!
    url.queryItems = query + [URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970 * 1000)))]
    UserDefaults.standard.set(url.string, forKey: "pulse.pendingLink")
    NotificationCenter.default.post(name: Notification.Name("PulsePendingLink"), object: nil)
  }
}

@available(iOS 16.0, *)
struct LogWithCoachIntent: AppIntent {
  static var title: LocalizedStringResource = "Log with Coach"
  static var description = IntentDescription("Tell your Pulse Coach what you ate, drank or did, and it logs it.")
  static var openAppWhenRun = true

  @Parameter(title: "What to log", requestValueDialog: IntentDialog("What should I log?"))
  var text: String

  @MainActor
  func perform() async throws -> some IntentResult {
    PulseLink.send([URLQueryItem(name: "q", value: text)])
    return .result()
  }
}

@available(iOS 16.0, *)
struct TalkToCoachIntent: AppIntent {
  static var title: LocalizedStringResource = "Talk to Coach"
  static var description = IntentDescription("Opens the Pulse Coach and starts listening.")
  static var openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    PulseLink.send([URLQueryItem(name: "mode", value: "voice")])
    return .result()
  }
}

@available(iOS 16.0, *)
struct PulseShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LogWithCoachIntent(),
      phrases: ["Log with \(.applicationName)", "Tell \(.applicationName) coach", "Hey \(.applicationName) coach"]
    )
    AppShortcut(
      intent: TalkToCoachIntent(),
      phrases: ["Talk to \(.applicationName)", "Talk to my \(.applicationName) coach"]
    )
  }
}
