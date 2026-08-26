# Zweifelsfreie Zuordnung von E-Mails zu Pipedrive-Deals

Stand: 26.08.2026 · Drei Lösungswege, Bewertung und Empfehlung

Ausgangslage: 120–130 parallel laufende Verfahren, Sachstandsanfragen gehen per Mail an die
Rechtsanwälte, die Antworten kommen im Postfach `info@gollenstede-sachverstand.de` an. Ausgehende
Mails werden über die dealspezifische Smart-BCC-Adresse mit dem Deal verknüpft, die Antworten
nicht. Gesucht ist ein Anker, der eine Konversation über beliebig viele Antwortrunden hinweg
zweifelsfrei einem Deal zuordnet — ein- wie ausgehend, in Outlook wie in Pipedrive.

---

## 1 Der Befund: Pipedrive führt zwei getrennte Threads pro Vorgang

Der Blick in die Pipedrive-Mailbox zeigt, dass die Ursache **nicht** eine unzuverlässige
Erkennung ist, sondern eine strukturelle Doppelung. Zu jeder Sachstandsanfrage existieren zwei
Threads:

| Thread | Herkunft | `smart_bcc_flag` | Inhalt | `deal_id` |
|---|---|---|---|---|
| 18991 | Smart-BCC-Kopie | 1 | nur unsere gesendete Mail | **1067** |
| 18990 | Postfach-Synchronisation | 0 | unsere Mail **und** die Antwort der Kanzlei | **leer** |

Dasselbe Muster bei den Deals 38, 54, 721, 767 und 1000 — jedes Mal trägt die BCC-Kopie den
Deal und enthält keine Antwort, und der synchronisierte Thread enthält die Antwort und trägt
keinen Deal.

Daraus folgen drei Dinge:

1. **Die Smart-BCC-Kopie ist eine Momentaufnahme.** Sie entsteht beim Versand und wächst nie
   mehr. Was danach passiert — die Antwort der Kanzlei, unsere Rückantwort — landet
   ausschliesslich im synchronisierten Thread.
2. **Die Postfach-Synchronisation läuft bereits und funktioniert.** Alle Antworten sind in
   Pipedrive vorhanden (`synced_flag: 1`). Sie hängen nur an keinem Deal. Es fehlt also keine
   Anbindung, es fehlt eine Verknüpfung.
3. **Die automatische Erkennung kann hier gar nicht greifen.** Pipedrive ordnet über die
   Personenadresse zu. `service@kanzlei-unfallrecht.com` ist eine Person, die an dutzenden
   offenen Deals hängt — die Zuordnung ist mehrdeutig, also unterbleibt sie. Bei 120–130
   parallelen Fällen mit einer Handvoll Stammkanzleien ist das der Regelfall, nicht die Ausnahme.

Ein vierter Fall kommt hinzu, den kein Versandanker je erreichen wird: Thread 19000 ist eine Mail
von `info@kanzlei-jasef.de` an `kfz-schaden.hannover@devk.de`, bei der wir nur im Verteiler
stehen. Betreff: `6117/25 - Jansen, Georg ./. DEVK - 2025.11.05.06874.2 - Unfallschaden vom
12.07.2025`. Diese Mail ist nie aus unserem Haus gestartet — sie enthält aber Kanzlei-Aktenzeichen
und Schadennummer, und beides steht in Pipedrive als Feld.

**Merksatz:** Der Anker muss beim Versand gesetzt werden, die Verknüpfung aber beim Eingang
geschrieben werden — und für Post, die nie bei uns startete, braucht es einen zweiten Weg.

---

## 2 Was die Lösung leisten muss

| | Anforderung |
|---|---|
| A1 | Der Anker übersteht `Re:`/`AW:`, Weiterleitungen, Sekretariatsbearbeitung und Zitatformatierung |
| A2 | Gilt für ausgehende **und** eingehende Mail, für Outlook **und** für Pipedrive |
| A3 | Das Ergebnis landet als verknüpfter Thread am Deal, nicht nur als Notizkopie |
| A4 | Keine Handarbeit im Regelfall — bei 120–130 Fällen ist jede manuelle Nachpflege tot |
| A5 | Was nicht zugeordnet werden kann, verschwindet nicht still, sondern landet sichtbar in einer Nachbearbeitung |
| A6 | Der Bestand der letzten Monate lässt sich nachträglich aufräumen, nicht nur der Neuzugang |

---

## 3 Weg 1 — Der Betreffanker

**Idee.** Jede ausgehende Mail trägt im Betreff ein maschinenlesbares Kürzel, etwa
`[GS-1067]` (Deal-ID) oder das ohnehin schon geführte autoiXpert-Aktenzeichen `0925/1696TG`.
Ein n8n-Dienst liest regelmässig alle Pipedrive-Threads ohne `deal_id`, sucht das Kürzel per
regulärem Ausdruck im Betreff und schreibt die Verknüpfung über
`PUT /v1/mailbox/mailThreads/{id}` mit `deal_id`.

**Warum das trägt.** Antwortende Mailprogramme lassen den Betreff bis auf das vorangestellte
`Re:`/`AW:` unangetastet — das ist der stabilste sichtbare Anker, den das Medium hergibt. Und die
Betreffzeilen der Sachstandsanfragen enthalten das Aktenzeichen bereits heute
(`Sachstandsanfrage zu: 0925/1696TG | Bernhard Nowak | HUK Coburg Vers. AG | …`). Es ist also
weniger ein Umbau als ein Auslesen dessen, was schon dasteht — plus die Zuordnungstabelle
Aktenzeichen → Deal, die über das Pipedrive-Feld „Autoixpert ID" ohnehin vorhanden ist.

**Grenzen.** Kanzleien, die aus ihrem Kanzleisystem heraus einen eigenen Betreff setzen, brechen
die Kette. Wer eine neue Mail schreibt statt zu antworten, ebenso. Und das Kürzel ist für den
Empfänger sichtbar — was für die Kanzlei kein Problem, gegenüber Anspruchstellern aber
erklärungsbedürftig ist.

**Aufwand.** Rund ein halber Tag in n8n. **Abdeckung: geschätzt 70–80 %** der Kanzleiantworten.

---

## 4 Weg 2 — Eine eigene Antwortadresse je Fall

**Idee.** Jede ausgehende Mail bekommt ein `Reply-To` mit eingebauter Deal-Kennung, etwa
`info+deal1067@gollenstede-sachverstand.de`. Antwortet die Kanzlei, geht die Antwort an genau
diese Adresse; die Deal-ID steht damit in der Empfängerzeile der eingehenden Mail und ist ohne
jede Deutung auslesbar.

**Warum das trägt.** Das ist der einzige Anker, den der Antwortende nicht versehentlich
umformulieren kann — er wird von seinem Mailprogramm gesetzt, nicht getippt. Exchange Online
unterstützt Plus-Adressierung seit April 2022 standardmässig, ohne dass Postfächer angelegt werden
müssen; alles läuft weiter im Postfach `info@`. Technisch ist es dasselbe Prinzip, das Pipedrive
für seine eigenen BCC-Adressen benutzt (`…+deal38@pipedrivemail.com`).

Eine Ausbaustufe: eine Exchange-Regel leitet Mails an `info+dealNNNN@` zusätzlich an die passende
Pipedrive-BCC-Adresse `…+dealNNNN@pipedrivemail.com` weiter — dann landet die Antwort ohne jede
Abgleichlogik am richtigen Deal.

**Grenzen.** Greift nur bei Antworten auf unsere Mails. Schreibt die Kanzlei neu, ist der Anker
weg. Einzelne Kanzleisysteme und ältere Verteiler stolpern über Plus-Adressen. Und die
Weiterleitungsvariante erzeugt wieder eine BCC-Kopie statt eines gewachsenen Threads — also
dieselbe Doppelung wie heute, nur mit richtiger Zuordnung.

**Aufwand.** Rund ein Tag, davon der grössere Teil in der Mail-Konfiguration und im Testen mit
zwei, drei Kanzleien. **Abdeckung: geschätzt 85–90 %** der Kanzleiantworten, 0 % der übrigen Post.

---

## 5 Weg 3 — Der Zuordnungsdienst mit Signalkaskade

**Idee.** Ein n8n-Dienst („Postfachwächter") läuft alle 5–10 Minuten, holt alle Pipedrive-Threads
ohne `deal_id` und arbeitet je Thread eine Kaskade von Signalen ab — vom härtesten zum weichsten.
Beim ersten Treffer wird verknüpft, sonst geht es eine Stufe weiter.

| Stufe | Signal | Sicherheit |
|---|---|---|
| S1 | Empfängeradresse enthält `+dealNNNN` (Weg 2) | eindeutig |
| S2 | `In-Reply-To`/`References` trifft einen Eintrag im Versandregister (jede ausgehende Mail wird mit `Message-ID` → Deal in einer n8n-Datentabelle abgelegt) | eindeutig |
| S3 | Betreff enthält `[GS-NNNN]` oder ein autoiXpert-Aktenzeichen (Weg 1) | eindeutig |
| S4 | Betreff oder Text enthält Kennzeichen, Schadennummer oder Vertragsnummer → Suche über die Pipedrive-Felder | sehr hoch, wenn genau ein Deal trifft |
| S5 | Absenderdomäne der Kanzlei + genau ein offener Deal mit dieser Kanzlei | hoch, sonst Kandidatenliste |
| S6 | KI-Vorschlag aus Betreff, Text und Kandidatenliste, mit Konfidenzwert | Vorschlag, kein Schreibvorgang |

Ab S1–S4 wird automatisch verknüpft. S5 nur bei Eindeutigkeit. S6 schreibt nie selbst, sondern
legt eine Aufgabe „E-Mail zuordnen" mit den drei wahrscheinlichsten Deals an. Was durchfällt,
landet in derselben Nachbearbeitungsliste — ein Klick ordnet zu, und die getroffene Zuordnung
wird als Regel gelernt (Absender → Deal, Message-ID nachgetragen).

**Warum das trägt.** Nur dieser Weg erreicht Post, die nie aus unserem Haus gestartet ist: die
Kanzlei, die uns ihren Schriftsatz an die Versicherung nachrichtlich schickt (Thread 19000), das
Schreiben der Versicherung, die Mail des Kunden. Bei 120–130 Fällen ist genau das der Anteil, der
die Akte unvollständig macht.

**Grenzen.** Der grösste Aufwand, und er braucht eine Bedienoberfläche für die Nachbearbeitung.
Die Kaskade muss über einige Wochen nachgeschärft werden.

**Aufwand.** Rund eine Woche bis zur tragenden Fassung, plus Nachschärfen.
**Abdeckung: geschätzt 95 %+ automatisch, der Rest sichtbar in der Nachbearbeitung.**

---

## 6 Bewertung nach Mailtyp

| Mailtyp | Weg 1 Betreff | Weg 2 Adresse | Weg 3 Kaskade |
|---|---|---|---|
| Antwort der Kanzlei auf unsere Anfrage | gut | sehr gut | sehr gut |
| Kanzlei antwortet mit neuem Betreff aus dem Kanzleisystem | fällt aus | sehr gut | sehr gut |
| Kanzlei schreibt uns neu (ohne Bezug auf unsere Mail) | fällt aus | fällt aus | gut (S4/S5) |
| Kanzlei setzt uns bei Schriftsatz an die Versicherung in Kopie | fällt aus | fällt aus | gut (S4) |
| Versicherung schreibt direkt | fällt aus | fällt aus | gut (S4) |
| Kunde schreibt zu seinem Fall | fällt aus | fällt aus | mittel (S5/S6) |
| Bestandsaufräumen der letzten Monate | gut | fällt aus | sehr gut |

Weg 1 und Weg 2 sind keine Alternativen zueinander — sie sind zwei **Anker**, und beide sind
billig. Weg 3 ist kein dritter Anker, sondern der **Mechanismus**, der Anker in Verknüpfungen
übersetzt und den Rest auffängt. Ohne Weg 3 bleibt selbst ein perfekter Anker wirkungslos, denn
niemand schreibt die `deal_id` auf den Thread.

---

## 7 Empfehlung

**Weg 3 als Rahmen, mit den Ankern aus Weg 1 und 2 als Stufen S1 bis S3 — und der Verzicht auf
die Smart-BCC-Kopie als eigentlicher Hebel.**

Die Begründung in vier Sätzen:

1. Das Problem ist keine Erkennungsschwäche, sondern eine fehlende Schreiboperation. Die Antworten
   liegen bereits in Pipedrive; es fehlt der eine API-Aufruf, der `deal_id` auf den
   synchronisierten Thread setzt. Diesen Aufruf braucht jeder der drei Wege — er ist der Kern.
2. Sobald der synchronisierte Thread verknüpft wird, ist die Smart-BCC-Kopie überflüssig und
   sogar schädlich: sie ist die Doppelung, die heute den Eindruck erzeugt, die Antwort sei
   verschwunden. Künftig gilt: **ein Thread je Vorgang, beide Richtungen darin, am Deal.**
3. Anker kosten fast nichts und vervielfachen die Trefferquote der oberen, sicheren Stufen — das
   Aktenzeichen steht im Betreff ohnehin schon, das `Reply-To` ist ein Feld im bestehenden
   Versand-Workflow `Sachstand verarbeiten (senden oder ueberspringen)`.
4. Nur die Kaskade erreicht die Post, die nie bei uns startete. Genau die ist es, die die Akte
   unvollständig macht — und für die es heute keinerlei Mechanismus gibt.

---

## 8 Umsetzung in Etappen

| Etappe | Inhalt | Aufwand | Nutzen |
|---|---|---|---|
| **E1 Rückverknüpfer** | n8n-Zeitplan: Threads ohne `deal_id` holen, Stufen S3/S4 (Aktenzeichen, Kennzeichen, Schadennummer) anwenden, `PUT mailThreads/{id}` schreiben. Einmalig über den Bestand der letzten sechs Monate laufen lassen. | ½ Tag | Die heute vorhandenen Antworten hängen sofort an ihren Deals |
| **E2 Anker beim Versand** | Im bestehenden Versand-Workflow: `Reply-To: info+dealNNNN@…` setzen, Betreffkürzel `[GS-NNNN]` ergänzen, `Message-ID` → Deal in eine n8n-Datentabelle schreiben. Smart-BCC vorerst parallel weiterlaufen lassen. | ½ Tag | Alle neuen Vorgänge sind ab Stufe S1/S2 eindeutig |
| **E3 Kaskade vervollständigen** | S2 (Message-ID-Register), S5 (Kanzlei-Kandidaten), S6 (KI-Vorschlag mit Konfidenzschwelle, schreibt nie selbst) | 1–2 Tage | Auch Post ohne Anker wird zugeordnet oder sauber vorgeschlagen |
| **E4 Nachbearbeitung** | Liste „ungeordnete E-Mails" mit Ein-Klick-Zuordnung — entweder als Pipedrive-Aufgabe oder als Seite in der Werkbank. Getroffene Zuordnungen werden als Regel gelernt. | 2–3 Tage | A5 erfüllt: nichts verschwindet still |
| **E5 Aufräumen** | Smart-BCC aus dem Versand nehmen, nachdem E1–E3 zwei Wochen stabil laufen | 1 Stunde | Ein Thread je Vorgang statt zwei |

Nach E1 und E2 — also nach etwa einem Tag Arbeit — ist der Hauptteil des Problems gelöst. E3 bis
E5 heben die Abdeckung von rund 80 % auf über 95 % und machen den Rest sichtbar.

---

## 9 Risiken und Grenzen

- **Ein Thread kann nur an einem Element hängen.** Pipedrive erlaubt je Thread genau eine
  Verknüpfung (Deal, Lead oder Projekt). Sammelmails, die mehrere Fälle betreffen, brauchen einen
  Hauptdeal plus Notizkopien an den übrigen — das ist eine bewusste Festlegung, keine Lücke.
- **Die Mailbox-Endpunkte liegen in der API v1.** Pipedrive baut schrittweise auf v2 um. Der
  Dienst sollte den Aufruf an einer Stelle kapseln, damit ein Wechsel eine Zeile ist.
- **Plus-Adressen scheitern bei einzelnen Gegenstellen.** Deshalb ist S1 nie der einzige Anker,
  sondern nur die oberste Stufe. Fällt sie aus, greift S2 oder S3.
- **Der KI-Vorschlag darf nicht schreiben.** Unterhalb der Konfidenzschwelle entsteht eine
  Aufgabe, keine Verknüpfung. Eine falsche Zuordnung ist schlimmer als keine, weil sie unbemerkt
  bleibt.
- **Datenschutz.** Das Versandregister speichert ausschliesslich `Message-ID`, Deal-ID und
  Zeitstempel — keine Mailinhalte. Inhalte bleiben, wo sie heute sind: in Microsoft 365 und
  Pipedrive.
- **Der Rückverknüpfer arbeitet auf Bestandsdaten.** Der erste Lauf sollte im Trockenmodus
  protokollieren, was er verknüpfen würde, bevor er schreibt.

---

## 10 Was noch zu entscheiden ist

1. **Betreffkürzel sichtbar oder nur Aktenzeichen?** Gegenüber Kanzleien unproblematisch,
   gegenüber Anspruchstellern eventuell nicht. Vorschlag: an Kanzleien `[GS-NNNN]`, an Kunden nur
   das `Reply-To`.
2. **Nachbearbeitung in Pipedrive oder in der Werkbank?** Pipedrive-Aufgaben sind ohne
   Entwicklungsaufwand da; eine Seite in der Werkbank wäre schneller zu bedienen.
3. **Smart-BCC abschalten oder dauerhaft parallel?** Empfehlung: nach zwei stabilen Wochen
   abschalten, damit je Vorgang nur noch ein Thread entsteht.
4. **Reichweite:** nur `info@` oder auch die persönlichen Postfächer? Für lückenlose Akten
   müssten alle Postfächer, aus denen Fallkorrespondenz geht, in der Synchronisation sein.
