import ExpoModulesCore

// Passes requests from Siri / Shortcuts (written by PulseAppIntents.swift in the app target) to JS:
// takePendingLink() for a cold launch, and an onLink event when the app is already running.
public class PulseIntentsModule: Module {
  private static let key = "pulse.pendingLink"
  private var observer: NSObjectProtocol?

  static func take() -> String? {
    let defaults = UserDefaults.standard
    guard let link = defaults.string(forKey: key) else { return nil }
    defaults.removeObject(forKey: key)
    return link
  }

  public func definition() -> ModuleDefinition {
    Name("PulseIntents")
    Events("onLink")

    Function("takePendingLink") { () -> String? in
      PulseIntentsModule.take()
    }

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(forName: Notification.Name("PulsePendingLink"), object: nil, queue: .main) { [weak self] _ in
        if let link = PulseIntentsModule.take() { self?.sendEvent("onLink", ["url": link]) }
      }
    }

    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }
  }
}
