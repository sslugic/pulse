import ExpoModulesCore
import UIKit

// Asks iOS for extra time to finish an AI request when the app leaves the foreground (the screen
// locks mid-answer, say). iOS grants about 30 seconds; when they run out, the time is handed back
// and the request is retried once the app is open again.
public class PulseBackgroundTimeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PulseBackgroundTime")

    AsyncFunction("begin") { () async -> Int in
      await MainActor.run {
        let task = BackgroundTask()
        task.id = UIApplication.shared.beginBackgroundTask(withName: "pulse-ai") { task.end() }
        return task.id.rawValue
      }
    }

    AsyncFunction("end") { (id: Int) async in
      await MainActor.run { UIApplication.shared.endBackgroundTask(UIBackgroundTaskIdentifier(rawValue: id)) }
    }
  }
}

private final class BackgroundTask {
  var id = UIBackgroundTaskIdentifier.invalid

  func end() {
    guard id != .invalid else { return }
    UIApplication.shared.endBackgroundTask(id)
    id = .invalid
  }
}
