import { useCallback, useEffect, useRef, useState } from "react";

const kinetic = { current: null };


function makeTransRefId() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-";

  for (var i = 0; i < 37; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

function loginProfile(userName='React', text, callback) {

  if (text == null) {
      text = userName
  }

  var userData = {
      name: userName,
      uCode: userName
  };
  kinetic.current.getProfile(userData, function (error, profileData) {
      if (error) {
          callback((error.message));
      } else {
          localStorage.setItem("profileCode", profileData.data.profileCode);
          localStorage.setItem("userName", userName);

          $("#successMessage").show();
          $("#txtUsername").disabled = true;
      }
  });
};


function makeTransaction() {
  var userName = 'react';
  var profileCode = localStorage.getItem("profileCode");
  // var profileCode = "llkk";

  if (profileCode == "" || userName == "") {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userName");
      localStorage.removeItem("profileCode");
      alert("Your session has expired. Please login again");
      window.location.href = "index.html";
  } else {
      kinetic.current.trackStop(function (trackData) {
          var transRefId = makeTransRefId();
          var body = {
              gestureInfo: trackData,
              profileCode: profileCode,
              transRefId: transRefId
          };

          console.log('trackData ' + trackData)

          kinetic.current.checkGesture(body, function (error, gestureData) {
              if (error) {
                  alert(JSON.stringify(error));
              } else {
                  localStorage.setItem("transRefId", gestureData.refId);
                  localStorage.setItem("appRefId", gestureData.data.reqRefId);

                  var score = gestureData.data.score;

                  // Score greater than thresh. value
                  if (score >= config.scoreThreshold) {
                      reportAction('allow', gestureData, true);
                      alert("Your mouse score is good: " + score);

                  } else {
                      // Score less than thres. value

                      // Ask for PIN input
                      var getPin = prompt("Your mouse score is not good " + score + "\nPlease enter your PIN", "");

                      if (getPin == null || getPin == "") {
                          // PIN cancelled
                          reportAction('deny', gestureData, false);
                      } else {

                          // PIN entered
                          if (getPin == config.defaultPin) {
                              // PIN is correct
                              reportAction('allow', gestureData, true);
                          } else {
                              // PIN is wrong
                              reportAction('deny', gestureData, false);
                          }
                      }
                  }
              }
          });
      });
  }
}

export default function Main() {
  const canvasRef = useRef(null);

  const [isPainting, setIsPainting] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const [mousePosition, setMousePosition] = useState(undefined);

  var options = {
    logging: false,
    trackingTimeSensitivity: 10,
    mouseTrackingElement: '#trackarea',
    debug: true,
    autoTracking: false,
    appKey: 'appKey',
    appSecret: 'appSecret',
    trackingInterval: 60,
    sensorPollingFrequency: 10,
    packageId: "packageId",
}

  const handleTrack = () => {
    if(!isTracking){
      kinetic.current.trackStart();
    }
    else{
      loginProfile('React', 'React', function (error, response) {
        if (error) {
            console.log(error);
            alert(error);
        } else {

            // Added inverse logic for confidence
            var confidence = (100 - parseFloat(response.responseData.data.confidence));

            if (response.responseData.data.score > config.loginThreshold) {
                alert('Authentication Success. (Score = ' + response.responseData.data.score + ' and Confidence = ' + confidence + ')');
                login(response.userName, function (error, response) {
                    if (error) {
                        console.log(error);
                        alert(error);
                    } else {
                        window.location.href = "transaction.html";
                    }
                });
            } else {
                alert('Authentication Failed. (Score = ' + response.responseData.data.score + ' and Confidence = ' + confidence + ')');
                //window.location.href = "index.html";
                // Ask for PIN input
                var getPin = prompt("Please enter your PIN", "");

                if (getPin == null || getPin == "") {
                    // PIN cancelled
                    window.location.href = "index.html";
                } else {

                    // PIN entered
                    if (getPin == config.defaultPin) {
                        // PIN is correct
                        login(response.userName, function (error, response) {
                            if (error) {
                                console.log(error);
                                alert(error);
                            } else {
                                window.location.href = "transaction.html";
                            }
                        });
                    } else {
                        // PIN is wrong
                        window.location.href = "index.html";
                    }
                }
            }
        }
      });
      makeTransaction();
    }
    setIsTracking((prev)=>!prev);
  }

  useEffect(() => {
    console.log(window);
    if (!kinetic.current && ZFS) {
      kinetic.current = new ZFS.KineticTracker();
      kinetic.current.init();
    }
    if (!kinetic.current) {
      return undefined;
    }
  }, []);

  const startPaint = useCallback((event) => {
    const coordinates = getCoordinates(event);
    if (coordinates) {
      setMousePosition(coordinates);
      setIsPainting(true);
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    canvas.addEventListener("mousedown", startPaint);
    return () => {
      canvas.removeEventListener("mousedown", startPaint);
    };
  }, [startPaint]);

  const paint = useCallback(
    (event) => {
      if (isPainting) {
        const newMousePosition = getCoordinates(event);
        if (mousePosition && newMousePosition) {
          drawLine(mousePosition, newMousePosition);
          setMousePosition(newMousePosition);
        }
      }
    },
    [isPainting, mousePosition]
  );

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    canvas.addEventListener("mousemove", paint);
    return () => {
      canvas.removeEventListener("mousemove", paint);
    };
  }, [paint]);

  const exitPaint = useCallback(() => {
    setIsPainting(false);
    setMousePosition(undefined);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    canvas.addEventListener("mouseup", exitPaint);
    canvas.addEventListener("mouseleave", exitPaint);
    return () => {
      canvas.removeEventListener("mouseup", exitPaint);
      canvas.removeEventListener("mouseleave", exitPaint);
    };
  }, [exitPaint]);

  const getCoordinates = (event) => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    return {
      x: event.pageX - canvas.offsetLeft,
      y: event.pageY - canvas.offsetTop
    };
  };

  const drawLine = (originalMousePosition, newMousePosition) => {
    if (!canvasRef.current) {
      return;
    }
    const context = canvasRef.current.getContext("2d");
    if (context) {
      context.strokeStyle = "navy";

      context.beginPath();
      context.moveTo(originalMousePosition.x, originalMousePosition.y);
      context.lineTo(newMousePosition.x, newMousePosition.y);
      context.stroke();
    }
  };

  return (
    <div className="App">
      <h1>Establish your digital hand-written signature</h1>
      <h2>Do it 15 more times</h2>
      <button onClick={handleTrack}>{isTracking?`Stop Tracking`:`Start Tracking`}</button>
      <div className="canvas-wrapper">
        <canvas id="#trackarea" className={isTracking?`tracking`:``} ref={canvasRef} width="400" height="100" />
        <hr className="divider-line" />
      </div>
    </div>
  );
}
