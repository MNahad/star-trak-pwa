package main

import (
	"errors"
	"io/ioutil"
	"log"
	"net/http"
)

func getData() ([]byte, error) {
	url := "https://celestrak.com/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json"
	client := http.Client{}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return make([]byte, 0), err
	}
	res, err := client.Do(req)
	if err != nil {
		return make([]byte, 0), err
	}
	if res.Body != nil {
		defer res.Body.Close()
	}
	if res.StatusCode > 299 {
		return make([]byte, 0), errors.New("error getting data")
	}
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return make([]byte, 0), err
	}
	return body, nil
}

func handler(w http.ResponseWriter, r *http.Request) {
	header := w.Header()
	header.Add("Allow", "GET,OPTIONS")
	header.Add("Access-Control-Allow-Origin", "*")
	header.Add("Access-Control-Allow-Methods", "GET,OPTIONS")
	if len(r.Header.Get("Access-Control-Request-Headers")) > 0 {
		header.Add("Access-Control-Allow-Headers", r.Header.Get("Access-Control-Request-Headers"))
	}
	header.Add("Access-Control-Max-Age", "86400")
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != "GET" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	data, err := getData()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	header.Add("Content-Type", "application/json; charset=UTF-8")
	w.Write(data)
}

func main() {
	http.HandleFunc("/gp", handler)
	log.Fatal(http.ListenAndServe(":5000", nil))
}
