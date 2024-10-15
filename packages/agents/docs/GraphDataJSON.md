### GraphData Example

#### graphDataLiteral
```json
{
  "version": 0.5,
  "nodes": {
    "source": {
      "value": "apple"
    },
    "source2": {
      "value": {
        "apple": "red"
      }
    },
    "step1": {
      "agent": "stringTemplateAgent",
      "params": {
        "template": "${0}, ${1}, ${2}."
      },
      "inputs": [
        ":source",
        "orange",
        null
      ],
      "isResult": true
    },
    "step2": {
      "agent": "sleeperAgent",
      "inputs": [
        ":source2",
        {
          "lemon": "yellow"
        }
      ],
      "isResult": true
    }
  }
}
```

#### graphDataInputs
```json
{
  "version": 0.5,
  "nodes": {
    "apple": {
      "value": {
        "fruits": {
          "apple": "red"
        }
      }
    },
    "lemon": {
      "value": {
        "fruits": {
          "lemon": "yellow"
        }
      }
    },
    "total": {
      "agent": "sleeperAgent",
      "inputs": [
        ":apple",
        ":lemon",
        ":apple.fruits",
        ":lemon.fruits"
      ]
    }
  }
}
```

#### graphDataAny
```json
{
  "version": 0.5,
  "nodes": {
    "source": {
      "value": {}
    },
    "positive": {
      "agent": "sleeperAgent",
      "anyInput": true,
      "isResult": true,
      "inputs": [
        ":source.yes"
      ]
    },
    "negative": {
      "agent": "sleeperAgent",
      "anyInput": true,
      "isResult": true,
      "inputs": [
        ":source.no"
      ]
    }
  }
}
```

#### graphDataAny2
```json
{
  "version": 0.5,
  "nodes": {
    "source1": {
      "value": {
        "apple": "red"
      }
    },
    "source2": {
      "value": {
        "lemon": "yellow"
      }
    },
    "router1": {
      "agent": "sleeperAgent",
      "params": {
        "duration": 10
      },
      "isResult": true,
      "inputs": [
        ":source1"
      ]
    },
    "router2": {
      "agent": "sleeperAgent",
      "params": {
        "duration": 100
      },
      "isResult": true,
      "inputs": [
        ":source2"
      ]
    },
    "receiver": {
      "agent": "sleeperAgent",
      "anyInput": true,
      "isResult": true,
      "inputs": [
        ":router1",
        ":router2"
      ]
    }
  }
}
```

#### graphDataNested
```json
{
  "version": 0.5,
  "nodes": {
    "source": {
      "value": {
        "nodes": {
          "source": {
            "value": 1
          },
          "result": {
            "agent": "copyAgent",
            "inputs": {
              "source": ":source"
            },
            "isResult": true
          }
        }
      }
    },
    "nested": {
      "agent": "nestedAgent",
      "graph": ":source",
      "isResult": true
    },
    "catch": {
      "agent": "propertyFilterAgent",
      "params": {
        "include": [
          "message"
        ]
      },
      "if": ":nested.onError",
      "inputs": {
        "item": ":nested.onError"
      },
      "isResult": true
    }
  }
}
```